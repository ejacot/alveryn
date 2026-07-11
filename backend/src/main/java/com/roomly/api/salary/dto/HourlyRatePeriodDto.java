package com.roomly.api.salary.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record HourlyRatePeriodDto(
    UUID id,
    UUID userId,
    @NotNull @PositiveOrZero BigDecimal hourlyRate,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @NotNull LocalDate validFrom,
    LocalDate validTo) {}
