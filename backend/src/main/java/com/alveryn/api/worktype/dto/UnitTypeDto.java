package com.alveryn.api.worktype.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

@Schema(description = "Unit type definition used by UNIT_BASED work entries")
public record UnitTypeDto(
    UUID id,
    UUID workTypeId,
    @NotBlank @Size(max = 100) String name,
    @NotNull @Positive BigDecimal unitsPerHour,
    @PositiveOrZero int displayOrder,
    boolean active) {}
