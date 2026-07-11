package com.roomly.api.worktype.dto;

import com.roomly.api.worktype.entity.CalculationMethod;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record WorkTypeDto(
    UUID id,
    UUID userId,
    @NotBlank @Size(max = 100) String name,
    @NotNull CalculationMethod calculationMethod,
    @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
    @Size(max = 100) String icon,
    @PositiveOrZero Integer defaultBreakMinutes,
    @PositiveOrZero int displayOrder,
    boolean active) {}
