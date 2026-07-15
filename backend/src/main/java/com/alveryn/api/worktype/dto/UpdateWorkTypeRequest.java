package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import jakarta.validation.constraints.*;

public record UpdateWorkTypeRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull CalculationMethod calculationMethod,
    CompensationMethod compensationMethod,
    @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
    @Size(max = 100) String icon,
    @PositiveOrZero Integer defaultBreakMinutes,
    @PositiveOrZero Integer displayOrder,
    boolean active) {
  public UpdateWorkTypeRequest(
      String name,
      CalculationMethod calculationMethod,
      String color,
      String icon,
      Integer defaultBreakMinutes,
      Integer displayOrder,
      boolean active) {
    this(name, calculationMethod, CompensationMethod.HOURLY, color, icon, defaultBreakMinutes, displayOrder, active);
  }
}
