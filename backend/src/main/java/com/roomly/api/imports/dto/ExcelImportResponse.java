package com.roomly.api.imports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Summary returned after importing one Excel schedule workbook")
public record ExcelImportResponse(
    @Schema(example = "Mariana 2025.xlsx") String fileName,
    @Schema(example = "2025") int detectedYear,
    @Schema(example = "Imported Shift") String workTypeName,
    @Schema(example = "27") int importedEntries,
    @Schema(example = "8") int importedAbsences,
    @Schema(example = "0") int createdWorkTypes,
    @Schema(example = "4") int skippedRows,
    @Schema(description = "Human-readable warnings produced while parsing the workbook")
        List<String> warnings) {}
