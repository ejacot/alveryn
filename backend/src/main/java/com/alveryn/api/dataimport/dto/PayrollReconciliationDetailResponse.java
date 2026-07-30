package com.alveryn.api.dataimport.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PayrollReconciliationDetailResponse(
    UUID id,
    UUID employmentId,
    int year,
    int month,
    String filename,
    String status,
    BigDecimal appWorkedHours,
    BigDecimal appAbsenceHours,
    BigDecimal appExtraHours,
    BigDecimal appGross,
    BigDecimal payrollWorkedHours,
    BigDecimal payrollAbsenceHours,
    BigDecimal payrollExtraHours,
    BigDecimal payrollGross,
    List<PayrollReconciliationResponse.PayrollLine> payrollLines,
    String notes,
    boolean documentAvailable,
    String documentFilename,
    String documentContentType,
    Long documentSize,
    BigDecimal workedHoursDifference,
    BigDecimal absenceHoursDifference,
    BigDecimal extraHoursDifference,
    BigDecimal grossDifference) {}
