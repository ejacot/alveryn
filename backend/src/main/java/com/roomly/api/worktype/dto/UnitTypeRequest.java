package com.roomly.api.worktype.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Schema(description = "Unit type request")
public record UnitTypeRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull @Positive BigDecimal unitsPerHour,
    @PositiveOrZero int displayOrder,
    boolean active) {}
