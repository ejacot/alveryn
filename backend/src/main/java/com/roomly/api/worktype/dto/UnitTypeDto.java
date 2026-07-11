package com.roomly.api.worktype.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record UnitTypeDto(
    UUID id,
    UUID workTypeId,
    @NotBlank @Size(max = 100) String name,
    @NotNull @Positive BigDecimal unitsPerHour,
    @PositiveOrZero int displayOrder,
    boolean active) {}
