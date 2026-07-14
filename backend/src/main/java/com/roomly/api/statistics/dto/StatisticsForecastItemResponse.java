package com.roomly.api.statistics.dto;

import java.math.BigDecimal;

public record StatisticsForecastItemResponse(
    String currency,
    BigDecimal actualGross,
    BigDecimal projectedGross,
    BigDecimal lowerBound,
    BigDecimal upperBound,
    int workedDays,
    int elapsedEligibleDays,
    int remainingEligibleDays,
    BigDecimal averageGrossPerWorkedDay,
    StatisticsConfidence confidence,
    boolean available,
    ForecastUnavailableReason reason) {}
