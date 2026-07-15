package com.alveryn.api.imports.model;

import com.alveryn.api.absence.entity.AbsenceType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record ParsedWorkbook(
    int detectedYear,
    List<ParsedMonth> recognizedSheets,
    List<String> ignoredSheets,
    List<ParsedWorkItem> workItems,
    List<ParsedAbsenceItem> absenceItems,
    List<String> warnings,
    int skippedRows) {

  public int totalImportableRows() {
    return workItems.size() + absenceItems.size();
  }

  public LocalDate minDate() {
    return workItems.stream()
        .map(ParsedWorkItem::workDate)
        .min(LocalDate::compareTo)
        .orElseGet(
            () ->
                absenceItems.stream()
                    .map(ParsedAbsenceItem::workDate)
                    .min(LocalDate::compareTo)
                    .orElse(null));
  }

  public LocalDate maxDate() {
    return workItems.stream()
        .map(ParsedWorkItem::workDate)
        .max(LocalDate::compareTo)
        .orElseGet(
            () ->
                absenceItems.stream()
                    .map(ParsedAbsenceItem::workDate)
                    .max(LocalDate::compareTo)
                    .orElse(null));
  }

  public record ParsedMonth(
      String sheetName, int month, int workEntries, int absences, int skippedRows) {}

  public record ParsedWorkItem(
      LocalDate workDate,
      String sourceSheet,
      String sourceKey,
      String fingerprint,
      BigDecimal calculatedMinutes,
      LocalTime startTime,
      LocalTime endTime,
      Integer breakMinutes,
      String notes) {}

  public record ParsedAbsenceItem(
      LocalDate workDate,
      String sourceSheet,
      String sourceKey,
      String fingerprint,
      AbsenceType absenceType,
      String notes) {}
}
