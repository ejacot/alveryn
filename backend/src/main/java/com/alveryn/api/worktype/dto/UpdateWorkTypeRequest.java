package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record UpdateWorkTypeRequest(
    @NotBlank @Size(max = 100) String name,
    UUID parentId,
    @NotNull CalculationMethod calculationMethod,
    CompensationMethod compensationMethod,
    @Size(max = 100) String unitLabel,
    @Size(max = 20) String unitSymbol,
    @Positive BigDecimal unitsPerHour,
    @Positive BigDecimal ratePerUnit,
    @Size(min = 3, max = 3) String currency,
    Boolean teamworkEnabled,
    Boolean extraPayEnabled,
    Boolean compositeEnabled,
    @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
    @Size(max = 100) String icon,
    @PositiveOrZero Integer defaultBreakMinutes,
    @PositiveOrZero Integer displayOrder,
    Boolean active) {
  public UpdateWorkTypeRequest(
      String name,
      CalculationMethod calculationMethod,
      String color,
      String icon,
      Integer defaultBreakMinutes,
      Integer displayOrder,
      boolean active) {
    this(
        name,
        null,
        calculationMethod,
        CompensationMethod.HOURLY,
        null,
        null,
        null,
        null,
        null,
        false,
        false,
        false,
        color,
        icon,
        defaultBreakMinutes,
        displayOrder,
        active);
  }

  public UpdateWorkTypeRequest(
      String name,
      UUID parentId,
      CalculationMethod calculationMethod,
      CompensationMethod compensationMethod,
      String unitLabel,
      String unitSymbol,
      BigDecimal unitsPerHour,
      BigDecimal ratePerUnit,
      String currency,
      Boolean teamworkEnabled,
      Boolean compositeEnabled,
      String color,
      String icon,
      Integer defaultBreakMinutes,
      Integer displayOrder,
      Boolean active) {
    this(name, parentId, calculationMethod, compensationMethod, unitLabel, unitSymbol,
        unitsPerHour, ratePerUnit, currency, teamworkEnabled, false, compositeEnabled,
        color, icon, defaultBreakMinutes, displayOrder, active);
  }
}
