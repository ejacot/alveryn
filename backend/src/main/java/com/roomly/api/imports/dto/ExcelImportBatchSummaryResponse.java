package com.roomly.api.imports.dto;

import com.roomly.api.imports.entity.ExcelImportBatchStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ExcelImportBatchSummaryResponse(
    UUID id,
    String fileName,
    int detectedYear,
    ExcelImportBatchStatus status,
    int importedEntriesCount,
    int importedAbsencesCount,
    int skippedRowsCount,
    int warningCount,
    OffsetDateTime createdAt,
    OffsetDateTime confirmedAt,
    OffsetDateTime undoneAt) {}
