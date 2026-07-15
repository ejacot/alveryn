package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import jakarta.validation.constraints.*;

public record CreateWorkTypeRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull CalculationMethod calculationMethod,
    @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
    @Size(max = 100) String icon,
    @PositiveOrZero Integer defaultBreakMinutes,
    @PositiveOrZero Integer displayOrder) {}
