package com.alveryn.api.dataimport.dto;

import java.util.List;
import java.util.UUID;

public record DataImportExecuteResponse(
    UUID batchId, int importedRecords, int importedLines, List<String> skippedEntryIds) {}
