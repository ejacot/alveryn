package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.util.UUID;

@Schema(description = "Work type definition used for work record line classification")
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
