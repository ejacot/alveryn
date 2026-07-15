package com.alveryn.api.imports.dto;

import com.alveryn.api.imports.entity.ExcelImportBatchStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ExcelImportBatchDetailResponse(
    UUID id,
    String fileName,
    int detectedYear,
    ExcelImportBatchStatus status,
    int recognizedSheetsCount,
    int importedEntriesCount,
    int importedAbsencesCount,
    int skippedRowsCount,
    int warningCount,
    OffsetDateTime createdAt,
    OffsetDateTime previewedAt,
    OffsetDateTime confirmedAt,
    OffsetDateTime undoneAt,
    String importedWorkTypeName,
    boolean undoAvailable,
    List<String> warnings) {}
