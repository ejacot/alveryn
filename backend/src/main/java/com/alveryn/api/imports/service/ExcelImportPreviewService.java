package com.alveryn.api.imports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.auth.util.AuthTokenGenerator;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.imports.config.ExcelImportProperties;
import com.alveryn.api.imports.dto.ExcelImportPreviewResponse;
import com.alveryn.api.imports.entity.ExcelImportBatch;
import com.alveryn.api.imports.entity.ExcelImportBatchStatus;
import com.alveryn.api.imports.repository.ExcelImportBatchRepository;
import com.alveryn.api.imports.model.ExcelImportErrorCode;
import com.alveryn.api.imports.model.ExcelImportPreviewPayload;
import com.alveryn.api.imports.model.ParsedWorkbook;
import com.alveryn.api.imports.parser.ExcelScheduleParser;
import com.alveryn.api.imports.parser.YearResolver;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.workentry.repository.WorkEntryRepository;
import com.alveryn.api.workentry.service.WorkEntryTimeOverlapService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ExcelImportPreviewService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserAccountRepository users;
  private final ExcelWorkbookValidator workbookValidator;
  private final YearResolver yearResolver;
  private final ExcelScheduleParser scheduleParser;
  private final WorkEntryRepository workEntries;
  private final AbsenceRepository absences;
  private final ExcelImportBatchRepository importBatches;
  private final ExcelImportProperties properties;
  private final AuthTokenGenerator tokenGenerator;
  private final Clock clock;
  private final ObjectMapper objectMapper;
  private final WorkEntryTimeOverlapService timeOverlapService;

  public ExcelImportPreviewService(
      AuthenticatedUserAccessor authenticatedUserAccessor,
      UserAccountRepository users,
      ExcelWorkbookValidator workbookValidator,
      YearResolver yearResolver,
      ExcelScheduleParser scheduleParser,
      WorkEntryRepository workEntries,
      AbsenceRepository absences,
      ExcelImportBatchRepository importBatches,
      ExcelImportProperties properties,
      AuthTokenGenerator tokenGenerator,
      Clock clock,
      ObjectMapper objectMapper,
      WorkEntryTimeOverlapService timeOverlapService) {
    this.authenticatedUserAccessor = authenticatedUserAccessor;
    this.users = users;
    this.workbookValidator = workbookValidator;
    this.yearResolver = yearResolver;
    this.scheduleParser = scheduleParser;
    this.workEntries = workEntries;
    this.absences = absences;
    this.importBatches = importBatches;
    this.properties = properties;
    this.tokenGenerator = tokenGenerator;
    this.clock = clock;
    this.objectMapper = objectMapper;
    this.timeOverlapService = timeOverlapService;
  }

  @Transactional
  public ExcelImportPreviewResponse preview(MultipartFile file, Integer fallbackYear) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    UserAccount user = users.findById(userId).orElseThrow();

    try (ExcelWorkbookValidator.ValidatedWorkbook workbook = workbookValidator.validate(file)) {
      int detectedYear =
          yearResolver.resolveYear(workbook.fileName(), workbook.workbook(), workbook.evaluator(), fallbackYear);
      ParsedWorkbook parsed =
          scheduleParser.parse(
              detectedYear,
              workbook.workbook(),
              workbook.evaluator(),
              properties.getMaxRowsPerSheet(),
              properties.getMaxTotalRows());

      if (parsed.recognizedSheets().isEmpty()) {
        throw new ValidationException(
            "No supported monthly sheets were found",
            ExcelImportErrorCode.EXCEL_NO_SUPPORTED_SHEETS.name());
      }
      if (parsed.totalImportableRows() == 0) {
        throw new ValidationException(
            "No supported monthly sheets or importable rows were found",
            ExcelImportErrorCode.EXCEL_NO_IMPORTABLE_ROWS.name());
      }

      boolean exactHashImported = importBatches.existsCompletedByUserIdAndFileSha256(userId, workbook.fileSha256());

      ExcelImportPreviewPayload payload =
          buildPreviewPayload(parsed, workbook.fileName(), workbook.fileSha256(), workbook.fileSizeBytes(), exactHashImported, userId);

      String previewToken = null;
      UUID previewBatchId = null;
      if (!exactHashImported) {
        String rawToken = tokenGenerator.generateOpaqueToken();
        String tokenHash = sha256(rawToken);
        OffsetDateTime now = OffsetDateTime.now(clock);
        ExcelImportBatch batch =
            importBatches
                .findByUserIdAndFileSha256(userId, workbook.fileSha256())
                .filter(existing -> existing.getStatus() != ExcelImportBatchStatus.COMPLETED)
                .orElseGet(
                    () ->
                        new ExcelImportBatch(
                            user,
                            workbook.fileName(),
                            workbook.fileSha256(),
                            workbook.fileSizeBytes(),
                            detectedYear));
        batch.markPreviewed(
            payload.recognizedSheets().size(),
            payload.totals().workEntries(),
            payload.totals().absences(),
            payload.totals().skippedRows(),
            payload.warnings().size(),
            now,
            now.plus(properties.getPreviewTokenLifetime()),
            tokenHash,
            writePayload(payload));
        importBatches.save(batch);
        previewToken = rawToken;
        previewBatchId = batch.getId();
      }

      return toResponse(payload, previewToken, previewBatchId);
    } catch (ValidationException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ValidationException(
          "The workbook could not be read", ExcelImportErrorCode.EXCEL_CORRUPTED.name());
    }
  }

  private ExcelImportPreviewPayload buildPreviewPayload(
      ParsedWorkbook parsed,
      String fileName,
      String fileSha256,
      long fileSizeBytes,
      boolean exactHashImported,
      UUID userId) {
    LocalDate minDate = parsed.minDate();
    LocalDate maxDate = parsed.maxDate();
    List<WorkEntry> existingWorkEntries =
        minDate != null && maxDate != null
            ? workEntries.findAllByUserIdAndWorkDateBetweenOrderByWorkDateAscCreatedAtAsc(userId, minDate, maxDate)
            : List.of();
    List<Absence> existingAbsences =
        minDate != null && maxDate != null
            ? absences.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(userId, maxDate, minDate)
            : List.of();

    Map<String, List<WorkEntry>> importedEntriesBySourceKey =
        groupWorkEntriesBySourceKey(
            workEntries.findAllByUserIdAndImportSourceKeyIn(
                userId, parsed.workItems().stream().map(ParsedWorkbook.ParsedWorkItem::sourceKey).toList()));
    Map<String, List<Absence>> importedAbsencesBySourceKey =
        groupAbsencesBySourceKey(
            absences.findAllByUserIdAndImportSourceKeyIn(
                userId, parsed.absenceItems().stream().map(ParsedWorkbook.ParsedAbsenceItem::sourceKey).toList()));
    Map<LocalDate, List<WorkEntry>> workEntriesByDate = groupWorkEntriesByDate(existingWorkEntries);
    Map<LocalDate, List<Absence>> absencesByDate = groupAbsencesByDate(existingAbsences);

    List<ExcelImportPreviewPayload.Conflict> conflicts = new ArrayList<>();
    List<ExcelImportPreviewPayload.DuplicateCandidate> duplicates = new ArrayList<>();
    List<ExcelImportPreviewPayload.WorkItemPlan> workPlans = new ArrayList<>();
    List<ExcelImportPreviewPayload.AbsenceItemPlan> absencePlans = new ArrayList<>();

    for (ParsedWorkbook.ParsedWorkItem item : parsed.workItems()) {
      ExcelImportPreviewPayload.ItemDisposition disposition =
          classifyWorkItem(
              userId,
              item,
              importedEntriesBySourceKey,
              absencesByDate,
              workPlans,
              conflicts,
              duplicates);
      workPlans.add(
          new ExcelImportPreviewPayload.WorkItemPlan(
              item.workDate(),
              item.sourceSheet(),
              item.sourceKey(),
              sha256(item.fingerprint()),
              item.calculatedMinutes(),
              item.startTime(),
              item.endTime(),
              item.breakMinutes(),
              item.notes(),
              disposition));
    }

    for (ParsedWorkbook.ParsedAbsenceItem item : parsed.absenceItems()) {
      ExcelImportPreviewPayload.ItemDisposition disposition =
          classifyAbsenceItem(item, importedAbsencesBySourceKey, workEntriesByDate, absencesByDate, conflicts, duplicates);
      absencePlans.add(
          new ExcelImportPreviewPayload.AbsenceItemPlan(
              item.workDate(),
              item.sourceSheet(),
              item.sourceKey(),
              sha256(item.fingerprint()),
              item.absenceType(),
              item.notes(),
              disposition));
    }

    List<ExcelImportPreviewPayload.Warning> warnings =
        parsed.warnings().stream()
            .limit(properties.getMaxWarnings())
            .map(message -> new ExcelImportPreviewPayload.Warning("EXCEL_WARNING", message))
            .toList();

    if (exactHashImported) {
      duplicates.add(
          new ExcelImportPreviewPayload.DuplicateCandidate(
              "FILE", null, fileSha256, "This exact workbook was already imported"));
    }

    boolean hasNewItems =
        workPlans.stream().anyMatch(plan -> plan.disposition() == ExcelImportPreviewPayload.ItemDisposition.NEW)
            || absencePlans.stream().anyMatch(plan -> plan.disposition() == ExcelImportPreviewPayload.ItemDisposition.NEW);
    boolean canImport = !exactHashImported && conflicts.isEmpty() && hasNewItems;

    return new ExcelImportPreviewPayload(
        fileName,
        fileSha256,
        fileSizeBytes,
        parsed.detectedYear(),
        parsed.recognizedSheets().stream()
            .map(sheet -> new ExcelImportPreviewPayload.MonthSummary(sheet.sheetName(), sheet.month(), sheet.workEntries(), sheet.absences(), sheet.skippedRows()))
            .toList(),
        parsed.ignoredSheets(),
        new ExcelImportPreviewPayload.Totals(parsed.workItems().size(), parsed.absenceItems().size(), parsed.skippedRows()),
        warnings,
        conflicts,
        duplicates,
        workPlans,
        absencePlans,
        canImport);
  }

  private ExcelImportPreviewPayload.ItemDisposition classifyWorkItem(
      UUID userId,
      ParsedWorkbook.ParsedWorkItem item,
      Map<String, List<WorkEntry>> importedEntriesBySourceKey,
      Map<LocalDate, List<Absence>> absencesByDate,
      List<ExcelImportPreviewPayload.WorkItemPlan> existingWorkPlans,
      List<ExcelImportPreviewPayload.Conflict> conflicts,
      List<ExcelImportPreviewPayload.DuplicateCandidate> duplicates) {
    List<WorkEntry> importedMatches = importedEntriesBySourceKey.getOrDefault(item.sourceKey(), List.of());
    String fingerprint = sha256(item.fingerprint());
    if (!importedMatches.isEmpty()) {
      boolean exactMatch = importedMatches.stream().anyMatch(entry -> Objects.equals(entry.getImportFingerprint(), fingerprint));
      if (exactMatch) {
        duplicates.add(new ExcelImportPreviewPayload.DuplicateCandidate("WORK_ENTRY", item.workDate(), item.sourceKey(), "An identical imported work entry already exists"));
        return ExcelImportPreviewPayload.ItemDisposition.DUPLICATE;
      }
      conflicts.add(new ExcelImportPreviewPayload.Conflict(ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name(), item.workDate(), item.sourceKey(), "This imported work day already exists with changed content"));
      return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
    }

    if (!absencesByDate.getOrDefault(item.workDate(), List.of()).isEmpty()) {
      conflicts.add(new ExcelImportPreviewPayload.Conflict(ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name(), item.workDate(), item.sourceKey(), "An absence already exists on this date"));
      return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
    }
    if (item.startTime() != null && item.endTime() != null) {
      var databaseConflict =
          timeOverlapService.findDatabaseConflict(
              userId, null, item.workDate(), item.startTime(), item.endTime());
      if (databaseConflict.isPresent()) {
        conflicts.add(
            new ExcelImportPreviewPayload.Conflict(
                WorkEntryTimeOverlapService.ERROR_CODE,
                item.workDate(),
                item.sourceKey(),
                timeOverlapService.previewMessage(databaseConflict.get())));
        return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
      }

      var workbookConflict =
          timeOverlapService.findWorkbookConflict(
              timeOverlapService.newTimeItems(existingWorkPlans),
              item.workDate(),
              item.startTime(),
              item.endTime());
      if (workbookConflict.isPresent()) {
        conflicts.add(
            new ExcelImportPreviewPayload.Conflict(
                WorkEntryTimeOverlapService.ERROR_CODE,
                item.workDate(),
                item.sourceKey(),
                timeOverlapService.workbookPreviewMessage(workbookConflict.get().interval())));
        return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
      }
    }
    return ExcelImportPreviewPayload.ItemDisposition.NEW;
  }

  private ExcelImportPreviewPayload.ItemDisposition classifyAbsenceItem(
      ParsedWorkbook.ParsedAbsenceItem item,
      Map<String, List<Absence>> importedAbsencesBySourceKey,
      Map<LocalDate, List<WorkEntry>> workEntriesByDate,
      Map<LocalDate, List<Absence>> absencesByDate,
      List<ExcelImportPreviewPayload.Conflict> conflicts,
      List<ExcelImportPreviewPayload.DuplicateCandidate> duplicates) {
    List<Absence> importedMatches = importedAbsencesBySourceKey.getOrDefault(item.sourceKey(), List.of());
    String fingerprint = sha256(item.fingerprint());
    if (!importedMatches.isEmpty()) {
      boolean exactMatch = importedMatches.stream().anyMatch(absence -> Objects.equals(absence.getImportFingerprint(), fingerprint));
      if (exactMatch) {
        duplicates.add(new ExcelImportPreviewPayload.DuplicateCandidate("ABSENCE", item.workDate(), item.sourceKey(), "An identical imported absence already exists"));
        return ExcelImportPreviewPayload.ItemDisposition.DUPLICATE;
      }
      conflicts.add(new ExcelImportPreviewPayload.Conflict(ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name(), item.workDate(), item.sourceKey(), "This imported absence already exists with changed content"));
      return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
    }

    if (!workEntriesByDate.getOrDefault(item.workDate(), List.of()).isEmpty()) {
      conflicts.add(new ExcelImportPreviewPayload.Conflict(ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name(), item.workDate(), item.sourceKey(), "A work entry already exists on this date"));
      return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
    }
    if (!absencesByDate.getOrDefault(item.workDate(), List.of()).isEmpty()) {
      conflicts.add(new ExcelImportPreviewPayload.Conflict(ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name(), item.workDate(), item.sourceKey(), "An absence already exists on this date"));
      return ExcelImportPreviewPayload.ItemDisposition.CONFLICT;
    }
    return ExcelImportPreviewPayload.ItemDisposition.NEW;
  }

  private Map<String, List<WorkEntry>> groupWorkEntriesBySourceKey(Collection<WorkEntry> entries) {
    Map<String, List<WorkEntry>> grouped = new HashMap<>();
    for (WorkEntry entry : entries) {
      grouped.computeIfAbsent(entry.getImportSourceKey(), ignored -> new ArrayList<>()).add(entry);
    }
    return grouped;
  }

  private Map<String, List<Absence>> groupAbsencesBySourceKey(Collection<Absence> entries) {
    Map<String, List<Absence>> grouped = new HashMap<>();
    for (Absence entry : entries) {
      grouped.computeIfAbsent(entry.getImportSourceKey(), ignored -> new ArrayList<>()).add(entry);
    }
    return grouped;
  }

  private Map<LocalDate, List<WorkEntry>> groupWorkEntriesByDate(Collection<WorkEntry> entries) {
    Map<LocalDate, List<WorkEntry>> grouped = new HashMap<>();
    for (WorkEntry entry : entries) {
      grouped.computeIfAbsent(entry.getWorkDate(), ignored -> new ArrayList<>()).add(entry);
    }
    return grouped;
  }

  private Map<LocalDate, List<Absence>> groupAbsencesByDate(Collection<Absence> entries) {
    Map<LocalDate, List<Absence>> grouped = new HashMap<>();
    for (Absence entry : entries) {
      LocalDate day = entry.getStartDate();
      while (!day.isAfter(entry.getEndDate())) {
        grouped.computeIfAbsent(day, ignored -> new ArrayList<>()).add(entry);
        day = day.plusDays(1);
      }
    }
    return grouped;
  }

  private String writePayload(ExcelImportPreviewPayload payload) {
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Could not serialize import preview payload", ex);
    }
  }

  private ExcelImportPreviewResponse toResponse(
      ExcelImportPreviewPayload payload, String previewToken, UUID previewBatchId) {
    return new ExcelImportPreviewResponse(
        payload.fileName(),
        payload.detectedYear(),
        payload.recognizedSheets().stream()
            .map(sheet -> new ExcelImportPreviewResponse.RecognizedSheet(sheet.sheetName(), sheet.month(), sheet.workEntries(), sheet.absences(), sheet.skippedRows()))
            .toList(),
        new ExcelImportPreviewResponse.Totals(
            payload.totals().workEntries(), payload.totals().absences(), payload.totals().skippedRows()),
        payload.ignoredSheets(),
        payload.warnings().stream().map(warning -> new ExcelImportPreviewResponse.Warning(warning.code(), warning.message())).toList(),
        payload.conflicts().stream().map(conflict -> new ExcelImportPreviewResponse.Conflict(conflict.code(), conflict.workDate(), conflict.sourceKey(), conflict.message())).toList(),
        payload.duplicateCandidates().stream().map(duplicate -> new ExcelImportPreviewResponse.DuplicateCandidate(duplicate.type(), duplicate.workDate(), duplicate.sourceKey(), duplicate.message())).toList(),
        payload.canImport(),
        previewToken,
        previewBatchId);
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }
}
