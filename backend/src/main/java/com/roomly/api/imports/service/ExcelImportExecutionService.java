package com.roomly.api.imports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.imports.dto.ExcelImportConfirmResponse;
import com.roomly.api.imports.entity.ExcelImportBatch;
import com.roomly.api.imports.entity.ExcelImportBatchStatus;
import com.roomly.api.imports.model.ExcelImportErrorCode;
import com.roomly.api.imports.model.ExcelImportPreviewPayload;
import com.roomly.api.imports.repository.ExcelImportBatchRepository;
import com.roomly.api.salary.service.SalaryCalculationService;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExcelImportExecutionService {
  private static final String IMPORTED_WORK_TYPE_NAME = "Imported Shift";
  private static final String IMPORTED_WORK_TYPE_NORMALIZED = "imported shift";
  private static final String IMPORTED_WORK_TYPE_COLOR = "#E5E7EB";

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final ExcelImportBatchRepository importBatches;
  private final ObjectMapper objectMapper;
  private final UserAccountRepository users;
  private final WorkTypeRepository workTypes;
  private final WorkEntryRepository workEntries;
  private final TimeEntryDetailsRepository timeEntryDetails;
  private final AbsenceRepository absences;
  private final SalaryCalculationService salaryCalculationService;
  private final Clock clock;

  public ExcelImportExecutionService(
      AuthenticatedUserAccessor authenticatedUserAccessor,
      ExcelImportBatchRepository importBatches,
      ObjectMapper objectMapper,
      UserAccountRepository users,
      WorkTypeRepository workTypes,
      WorkEntryRepository workEntries,
      TimeEntryDetailsRepository timeEntryDetails,
      AbsenceRepository absences,
      SalaryCalculationService salaryCalculationService,
      Clock clock) {
    this.authenticatedUserAccessor = authenticatedUserAccessor;
    this.importBatches = importBatches;
    this.objectMapper = objectMapper;
    this.users = users;
    this.workTypes = workTypes;
    this.workEntries = workEntries;
    this.timeEntryDetails = timeEntryDetails;
    this.absences = absences;
    this.salaryCalculationService = salaryCalculationService;
    this.clock = clock;
  }

  @Transactional
  public ExcelImportConfirmResponse confirm(String previewToken) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    String previewTokenHash = sha256(previewToken);
    ExcelImportBatch batch =
        importBatches
            .findClaimablePreviewForUpdate(userId, previewTokenHash, ExcelImportBatchStatus.PREVIEWED)
            .orElseThrow(
                () ->
                    new ConflictException(
                        "This import preview is no longer available",
                        ExcelImportErrorCode.EXCEL_PREVIEW_EXPIRED.name()));

    OffsetDateTime now = OffsetDateTime.now(clock);
    if (batch.isPreviewExpired(now)) {
      throw new ConflictException(
          "This import preview has expired", ExcelImportErrorCode.EXCEL_PREVIEW_EXPIRED.name());
    }

    ExcelImportPreviewPayload payload = readPayload(batch.getPreviewPayloadJson());
    if (!payload.canImport() || !payload.conflicts().isEmpty()) {
      throw new ConflictException(
          "This import preview has blocking conflicts",
          ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
    }
    batch.markConfirming();

    UserAccount user = users.findById(userId).orElseThrow();
    WorkType importedWorkType = null;
    boolean createdFallbackWorkType = false;
    int importedEntries = 0;
    int importedAbsences = 0;

    for (ExcelImportPreviewPayload.WorkItemPlan item : payload.workItems()) {
      if (item.disposition() != ExcelImportPreviewPayload.ItemDisposition.NEW) {
        continue;
      }
      if (!workEntries.findAllByUserIdAndWorkDateOrderByCreatedAt(userId, item.workDate()).isEmpty()
          || absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
              userId, item.workDate(), item.workDate())) {
        throw new ConflictException(
            "Import data changed after preview. Generate a new preview before importing.",
            ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
      }
      if (!workEntries.findAllByUserIdAndImportSourceKeyIn(userId, List.of(item.sourceKey())).isEmpty()) {
        throw new ConflictException(
            "An imported work entry already exists for this source row",
            ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
      }

      if (importedWorkType == null) {
        importedWorkType = workTypes.findByUserIdAndNormalizedName(userId, IMPORTED_WORK_TYPE_NORMALIZED).orElse(null);
        if (importedWorkType == null) {
          importedWorkType = new WorkType(user, IMPORTED_WORK_TYPE_NAME, CalculationMethod.TIME_BASED);
          importedWorkType.changeColor(IMPORTED_WORK_TYPE_COLOR);
          importedWorkType.changeDisplayOrder(999);
          importedWorkType = workTypes.save(importedWorkType);
          createdFallbackWorkType = true;
        }
      }

      SalaryCalculationService.SalarySnapshot salary =
          salaryCalculationService.calculateForDate(userId, item.workDate(), item.calculatedMinutes());
      WorkEntry entry =
          workEntries.save(
              new WorkEntry(
                  user,
                  importedWorkType,
                  item.workDate(),
                  salary.hourlyRate(),
                  salary.currency(),
                  item.calculatedMinutes()));
      entry.updateNotes(item.notes());
      entry.markImported(batch, item.sourceKey(), item.fingerprint());

      if (item.startTime() != null && item.endTime() != null && item.breakMinutes() != null) {
        timeEntryDetails.save(new TimeEntryDetails(entry, item.startTime(), item.endTime(), item.breakMinutes()));
      }
      importedEntries++;
    }

    for (ExcelImportPreviewPayload.AbsenceItemPlan item : payload.absenceItems()) {
      if (item.disposition() != ExcelImportPreviewPayload.ItemDisposition.NEW) {
        continue;
      }
      if (!workEntries.findAllByUserIdAndWorkDateOrderByCreatedAt(userId, item.workDate()).isEmpty()
          || absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
              userId, item.workDate(), item.workDate())) {
        throw new ConflictException(
            "Import data changed after preview. Generate a new preview before importing.",
            ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
      }
      if (!absences.findAllByUserIdAndImportSourceKeyIn(userId, List.of(item.sourceKey())).isEmpty()) {
        throw new ConflictException(
            "An imported absence already exists for this source row",
            ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
      }

      Absence absence = new Absence(user, item.absenceType(), item.workDate(), item.workDate());
      absence.updateNotes(item.notes());
      absence.markImported(batch, item.sourceKey(), item.fingerprint());
      absences.save(absence);
      importedAbsences++;
    }

    batch.markCompleted(
        importedWorkType,
        createdFallbackWorkType,
        importedEntries,
        importedAbsences,
        payload.totals().skippedRows(),
        payload.warnings().size(),
        now);

    return new ExcelImportConfirmResponse(
        batch.getId(),
        payload.fileName(),
        payload.detectedYear(),
        importedWorkType != null ? importedWorkType.getName() : null,
        importedEntries,
        importedAbsences,
        payload.totals().skippedRows(),
        payload.warnings().stream().map(ExcelImportPreviewPayload.Warning::message).toList());
  }

  private ExcelImportPreviewPayload readPayload(String json) {
    try {
      return objectMapper.readValue(json, ExcelImportPreviewPayload.class);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Could not deserialize import preview payload", ex);
    }
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.trim().getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }
}
