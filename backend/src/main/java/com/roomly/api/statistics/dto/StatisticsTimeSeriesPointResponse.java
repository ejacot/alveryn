package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "One statistics time series point")
public record StatisticsTimeSeriesPointResponse(
    LocalDate bucketStart,
    LocalDate bucketEnd,
    BigDecimal value,
    StatisticsMetric metric,
    String currency) {}
