package com.roomly.api.imports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ExcelImportPreviewResponse(
    String fileName,
    int detectedYear,
    List<RecognizedSheet> recognizedSheets,
    Totals totals,
    List<String> ignoredSheets,
    List<Warning> warnings,
    List<Conflict> conflicts,
    List<DuplicateCandidate> duplicateCandidates,
    boolean canImport,
    @Schema(nullable = true) String previewToken,
    @Schema(nullable = true) UUID previewBatchId) {

  public record RecognizedSheet(
      String sheetName, int month, int workEntries, int absences, int skippedRows) {}

  public record Totals(int workEntries, int absences, int skippedRows) {}

  public record Warning(String code, String message) {}

  public record Conflict(String code, LocalDate workDate, String sourceKey, String message) {}

  public record DuplicateCandidate(String type, LocalDate workDate, String sourceKey, String message) {}
}
