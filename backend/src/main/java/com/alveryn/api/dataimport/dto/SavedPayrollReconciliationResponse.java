package com.alveryn.api.dataimport.dto;
import java.math.BigDecimal;
import java.util.UUID;
public record SavedPayrollReconciliationResponse(
    UUID id, String status, BigDecimal workedHoursDifference, BigDecimal absenceHoursDifference,
    BigDecimal extraHoursDifference, BigDecimal grossDifference) {}
