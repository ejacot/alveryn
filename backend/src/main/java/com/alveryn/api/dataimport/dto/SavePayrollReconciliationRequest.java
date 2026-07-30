package com.alveryn.api.dataimport.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
public record SavePayrollReconciliationRequest(
    @NotNull UUID employmentId, @Min(2000) @Max(2100) int year, @Min(1) @Max(12) int month,
    String filename, BigDecimal appWorkedHours, BigDecimal appAbsenceHours,
    BigDecimal appExtraHours, BigDecimal appGross, BigDecimal payrollWorkedHours,
    BigDecimal payrollAbsenceHours, BigDecimal payrollExtraHours, BigDecimal payrollGross,
    @NotNull List<PayrollReconciliationResponse.PayrollLine> payrollLines,
    @Size(max=1000) String notes) {}
