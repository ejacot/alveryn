package com.roomly.api.salary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Hourly rate period request")
public record HourlyRatePeriodRequest(
    @NotNull @PositiveOrZero BigDecimal hourlyRate,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @NotNull LocalDate validFrom,
    LocalDate validTo) {}
