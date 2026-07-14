package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Aggregated statistics overview for the selected filters")
public record StatisticsOverviewResponse(
    BigDecimal grossAmount,
    String currency,
    BigDecimal workedMinutes,
    int workedDays,
    long entries,
    BigDecimal averageMinutesPerDay,
    BigDecimal comparisonPercentage,
    ComparisonDirection comparisonDirection) {}
