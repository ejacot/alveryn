package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Aggregated statistics overview for the selected filters")
public record StatisticsOverviewResponse(
    List<MoneyAmountResponse> grossByCurrency,
    BigDecimal workedMinutes,
    int workedDays,
    long entries,
    BigDecimal averageMinutesPerDay,
    StatisticsComparisonResponse comparison) {}
