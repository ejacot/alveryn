package com.roomly.api.imports.service;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.imports.dto.ExcelImportBatchDetailResponse;
import com.roomly.api.imports.entity.ExcelImportBatch;
import com.roomly.api.imports.entity.ExcelImportBatchStatus;
import com.roomly.api.imports.model.ExcelImportErrorCode;
import com.roomly.api.imports.repository.ExcelImportBatchRepository;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExcelImportUndoService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final ExcelImportBatchRepository importBatches;
  private final WorkEntryRepository workEntries;
  private final AbsenceRepository absences;
  private final TimeEntryDetailsRepository timeEntryDetails;
  private final UnitEntryItemRepository unitEntryItems;
  private final WorkTypeRepository workTypes;
  private final ExcelImportHistoryService historyService;
  private final Clock clock;

  public ExcelImportUndoService(
      AuthenticatedUserAccessor authenticatedUserAccessor,
      ExcelImportBatchRepository importBatches,
      WorkEntryRepository workEntries,
      AbsenceRepository absences,
      TimeEntryDetailsRepository timeEntryDetails,
      UnitEntryItemRepository unitEntryItems,
      WorkTypeRepository workTypes,
      ExcelImportHistoryService historyService,
      Clock clock) {
    this.authenticatedUserAccessor = authenticatedUserAccessor;
    this.importBatches = importBatches;
    this.workEntries = workEntries;
    this.absences = absences;
    this.timeEntryDetails = timeEntryDetails;
    this.unitEntryItems = unitEntryItems;
    this.workTypes = workTypes;
    this.historyService = historyService;
    this.clock = clock;
  }

  @Transactional
  public ExcelImportBatchDetailResponse undo(UUID batchId) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    ExcelImportBatch batch =
        importBatches
            .findByIdAndUserId(batchId, userId)
            .orElseThrow(
                () ->
                    new NotFoundException("ExcelImportBatch", batchId));

    if (batch.getStatus() == ExcelImportBatchStatus.UNDONE) {
      throw new ConflictException(
          "This import batch was already undone",
          ExcelImportErrorCode.EXCEL_BATCH_ALREADY_UNDONE.name());
    }
    if (batch.getStatus() != ExcelImportBatchStatus.COMPLETED) {
      throw new ConflictException(
          "Only completed import batches can be undone",
          ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
    }

    List<WorkEntry> importedEntries = workEntries.findAllByImportBatchId(batchId);
    List<Absence> importedAbsences = absences.findAllByImportBatchId(batchId);
    ensureImportedRecordsWereNotEdited(batch, importedEntries, importedAbsences);

    for (WorkEntry entry : importedEntries) {
      timeEntryDetails.deleteByWorkEntryId(entry.getId());
      unitEntryItems.deleteAllByWorkEntryId(entry.getId());
      workEntries.delete(entry);
    }
    for (Absence absence : importedAbsences) {
      absences.delete(absence);
    }

    if (batch.isCreatedFallbackWorkType()
        && batch.getImportedWorkType() != null
        && !workEntries.existsByUserIdAndWorkTypeId(userId, batch.getImportedWorkType().getId())) {
      batch.getImportedWorkType().deactivate();
      workTypes.save(batch.getImportedWorkType());
    }

    batch.markUndone(OffsetDateTime.now(clock));
    return historyService.get(batchId);
  }

  private void ensureImportedRecordsWereNotEdited(
      ExcelImportBatch batch, List<WorkEntry> importedEntries, List<Absence> importedAbsences) {
    if (batch.getConfirmedAt() == null) {
      throw new ConflictException(
          "Only completed import batches can be undone",
          ExcelImportErrorCode.EXCEL_IMPORT_CONFLICT.name());
    }
    OffsetDateTime importCompletedAt = batch.getUpdatedAt();
    boolean hasEditedEntry =
        importedEntries.stream().anyMatch(entry -> entry.getUpdatedAt().isAfter(importCompletedAt));
    boolean hasEditedAbsence =
        importedAbsences.stream().anyMatch(absence -> absence.getUpdatedAt().isAfter(importCompletedAt));

    if (hasEditedEntry || hasEditedAbsence) {
      throw new ConflictException(
          "This import contains records that were edited after import. Review them before undoing.",
          ExcelImportErrorCode.EXCEL_IMPORT_UNDO_MODIFIED_RECORDS.name());
    }
  }
}
