package com.alveryn.api.salary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Hourly rate period used to resolve historical salary calculations")
public record HourlyRatePeriodResponse(
    UUID id, BigDecimal hourlyRate, String currency, LocalDate validFrom, LocalDate validTo) {}
