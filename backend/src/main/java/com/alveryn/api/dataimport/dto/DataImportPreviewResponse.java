package com.alveryn.api.dataimport.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DataImportPreviewResponse(
    UUID batchId,
    int readyCount,
    int questionCount,
    int duplicateCount,
    List<Entry> entries) {

  public record Entry(
      String id,
      LocalDate date,
      String status,
      String classification,
      String absenceType,
      Boolean absencePaid,
      Integer absencePaidMinutesPerDay,
      Integer teamSize,
      String sheet,
      int sourceRow,
      String notes,
      List<Line> lines,
      List<Question> questions) {}

  public record Line(
      UUID workTypeId,
      String workTypeName,
      String calculationMethod,
      BigDecimal value,
      Integer durationMinutes) {}

  public record Question(
      String id,
      String type,
      String sourceLabel,
      String value,
      String prompt,
      List<String> options) {}
}
