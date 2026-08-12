package com.alveryn.api.dataimport.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public record PayrollReconciliationResponse(
    String filename,
    Integer year,
    Integer month,
    BigDecimal normalHours,
    BigDecimal normalRate,
    BigDecimal normalAmount,
    String absenceLabel,
    BigDecimal absenceDays,
    BigDecimal absenceHours,
    BigDecimal absenceRate,
    BigDecimal absenceAmount,
    BigDecimal extraHours,
    BigDecimal extraAmount,
    BigDecimal grossAmount,
    BigDecimal confidence,
    String status,
    String countryCode,
    String languageCode,
    String currency,
    String documentCompleteness,
    boolean requiresReview,
    List<String> warnings,
    Integer sourcePage,
    boolean periodInferredFromCalendar,
    List<PayrollLine> payrollLines) {

  public record PayrollLine(
      String code,
      String label,
      BigDecimal quantity,
      BigDecimal factor,
      BigDecimal percentage,
      BigDecimal amount,
      Boolean grossRelevant,
      String category,
      String unit,
      BigDecimal confidence,
      String evidenceText) {}

  public static PayrollReconciliationResponse from(JsonNode node) {
    return new PayrollReconciliationResponse(
        text(node, "filename"),
        integer(node, "year"),
        integer(node, "month"),
        decimal(node, "normalHours"),
        decimal(node, "normalRate"),
        decimal(node, "normalAmount"),
        text(node, "absenceLabel"),
        decimal(node, "absenceDays"),
        decimal(node, "absenceHours"),
        decimal(node, "absenceRate"),
        decimal(node, "absenceAmount"),
        decimal(node, "extraHours"),
        decimal(node, "extraAmount"),
        decimal(node, "grossAmount"),
        decimal(node, "confidence"),
        text(node, "status"),
        text(node, "countryCode"),
        text(node, "languageCode"),
        text(node, "currency"),
        text(node, "documentCompleteness"),
        node.path("requiresReview").asBoolean(false),
        strings(node.path("warnings")),
        integer(node, "sourcePage"),
        node.path("periodInferredFromCalendar").asBoolean(false),
        payrollLines(node.path("payrollLines")));
  }

  private static List<PayrollLine> payrollLines(JsonNode lines) {
    if (!lines.isArray()) return List.of();
    List<PayrollLine> result = new ArrayList<>();
    lines.forEach(line -> result.add(new PayrollLine(
        text(line, "code"),
        text(line, "label"),
        decimal(line, "quantity"),
        decimal(line, "factor"),
        decimal(line, "percentage"),
        decimal(line, "amount"),
        bool(line, "grossRelevant"),
        text(line, "category"),
        text(line, "unit"),
        decimal(line, "confidence"),
        text(line, "evidenceText"))));
    return List.copyOf(result);
  }

  private static List<String> strings(JsonNode values) {
    if (!values.isArray()) return List.of();
    List<String> result = new ArrayList<>();
    values.forEach(value -> { if (value.isTextual()) result.add(value.asText()); });
    return List.copyOf(result);
  }

  private static String text(JsonNode node, String field) {
    return node.path(field).isTextual() ? node.path(field).asText() : null;
  }

  private static Integer integer(JsonNode node, String field) {
    return node.path(field).isIntegralNumber() ? node.path(field).asInt() : null;
  }

  private static BigDecimal decimal(JsonNode node, String field) {
    return node.path(field).isNumber() ? node.path(field).decimalValue() : null;
  }

  private static Boolean bool(JsonNode node, String field) {
    return node.path(field).isBoolean() ? node.path(field).asBoolean() : null;
  }
}
