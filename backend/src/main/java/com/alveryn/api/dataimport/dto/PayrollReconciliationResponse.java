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
      Boolean grossRelevant) {}

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
        bool(line, "grossRelevant"))));
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
