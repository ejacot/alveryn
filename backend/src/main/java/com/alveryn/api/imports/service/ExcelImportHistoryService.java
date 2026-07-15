package com.alveryn.api.imports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.imports.dto.ExcelImportBatchDetailResponse;
import com.alveryn.api.imports.dto.ExcelImportBatchSummaryResponse;
import com.alveryn.api.imports.entity.ExcelImportBatch;
import com.alveryn.api.imports.entity.ExcelImportBatchStatus;
import com.alveryn.api.imports.model.ExcelImportPreviewPayload;
import com.alveryn.api.imports.repository.ExcelImportBatchRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExcelImportHistoryService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final ExcelImportBatchRepository importBatches;
  private final ObjectMapper objectMapper;

  public ExcelImportHistoryService(
      AuthenticatedUserAccessor authenticatedUserAccessor,
      ExcelImportBatchRepository importBatches,
      ObjectMapper objectMapper) {
    this.authenticatedUserAccessor = authenticatedUserAccessor;
    this.importBatches = importBatches;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public List<ExcelImportBatchSummaryResponse> list() {
    return importBatches.findAllByUserIdOrderByCreatedAtDesc(authenticatedUserAccessor.requireUserId()).stream()
        .map(this::toSummary)
        .toList();
  }

  @Transactional(readOnly = true)
  public ExcelImportBatchDetailResponse get(UUID batchId) {
    ExcelImportBatch batch =
        importBatches
            .findByIdAndUserId(batchId, authenticatedUserAccessor.requireUserId())
            .orElseThrow(() -> new NotFoundException("ExcelImportBatch", batchId));
    ExcelImportPreviewPayload payload = readPayload(batch.getPreviewPayloadJson());
    return new ExcelImportBatchDetailResponse(
        batch.getId(),
        batch.getFileName(),
        batch.getDetectedYear(),
        batch.getStatus(),
        batch.getRecognizedSheetsCount(),
        batch.getImportedEntriesCount(),
        batch.getImportedAbsencesCount(),
        batch.getSkippedRowsCount(),
        batch.getWarningCount(),
        batch.getCreatedAt(),
        batch.getPreviewedAt(),
        batch.getConfirmedAt(),
        batch.getUndoneAt(),
        batch.getImportedWorkType() != null ? batch.getImportedWorkType().getName() : null,
        batch.getStatus() == ExcelImportBatchStatus.COMPLETED,
        payload != null ? payload.warnings().stream().map(ExcelImportPreviewPayload.Warning::message).toList() : List.of());
  }

  private ExcelImportBatchSummaryResponse toSummary(ExcelImportBatch batch) {
    return new ExcelImportBatchSummaryResponse(
        batch.getId(),
        batch.getFileName(),
        batch.getDetectedYear(),
        batch.getStatus(),
        batch.getImportedEntriesCount(),
        batch.getImportedAbsencesCount(),
        batch.getSkippedRowsCount(),
        batch.getWarningCount(),
        batch.getCreatedAt(),
        batch.getConfirmedAt(),
        batch.getUndoneAt());
  }

  private ExcelImportPreviewPayload readPayload(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return objectMapper.readValue(json, ExcelImportPreviewPayload.class);
    } catch (JsonProcessingException ex) {
      return null;
    }
  }
}
