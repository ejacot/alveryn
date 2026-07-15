package com.alveryn.api.salary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Hourly rate period used to resolve historical salary calculations")
public record HourlyRatePeriodDto(
    UUID id,
    UUID userId,
    @NotNull @PositiveOrZero BigDecimal hourlyRate,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @NotNull LocalDate validFrom,
    LocalDate validTo) {}
