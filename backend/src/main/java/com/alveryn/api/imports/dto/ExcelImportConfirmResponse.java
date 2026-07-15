package com.alveryn.api.imports.dto;

import java.util.List;
import java.util.UUID;

public record ExcelImportConfirmResponse(
    UUID batchId,
    String fileName,
    int detectedYear,
    String workTypeName,
    int importedEntries,
    int importedAbsences,
    int skippedRows,
    List<String> warnings) {}
