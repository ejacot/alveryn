package com.alveryn.api.imports.model;

import com.alveryn.api.absence.entity.AbsenceType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record ExcelImportPreviewPayload(
    String fileName,
    String fileSha256,
    long fileSizeBytes,
    int detectedYear,
    List<MonthSummary> recognizedSheets,
    List<String> ignoredSheets,
    Totals totals,
    List<Warning> warnings,
    List<Conflict> conflicts,
    List<DuplicateCandidate> duplicateCandidates,
    List<WorkItemPlan> workItems,
    List<AbsenceItemPlan> absenceItems,
    boolean canImport) {

  public record MonthSummary(
      String sheetName, int month, int workEntries, int absences, int skippedRows) {}

  public record Totals(int workEntries, int absences, int skippedRows) {}

  public record Warning(String code, String message) {}

  public record Conflict(String code, LocalDate workDate, String sourceKey, String message) {}

  public record DuplicateCandidate(String type, LocalDate workDate, String sourceKey, String message) {}

  public record WorkItemPlan(
      LocalDate workDate,
      String sourceSheet,
      String sourceKey,
      String fingerprint,
      BigDecimal calculatedMinutes,
      LocalTime startTime,
      LocalTime endTime,
      Integer breakMinutes,
      String notes,
      ItemDisposition disposition) {}

  public record AbsenceItemPlan(
      LocalDate workDate,
      String sourceSheet,
      String sourceKey,
      String fingerprint,
      AbsenceType absenceType,
      String notes,
      ItemDisposition disposition) {}

  public enum ItemDisposition {
    NEW,
    DUPLICATE,
    CONFLICT
  }
}
