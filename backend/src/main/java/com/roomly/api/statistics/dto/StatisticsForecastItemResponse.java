package com.roomly.api.statistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StatisticsForecastItemResponse(
    String currency,
    BigDecimal actualGross,
    BigDecimal projectedGross,
    BigDecimal lowerBound,
    BigDecimal upperBound,
    int workedDays,
    int elapsedEligibleDays,
    int remainingEligibleDays,
    BigDecimal observedWorkFrequency,
    BigDecimal expectedRemainingWorkedDays,
    boolean todayIncludedInElapsed,
    String calculationBasis,
    int sampleSize,
    LocalDate recentWindowStart,
    LocalDate recentWindowEnd,
    int recentEligibleDays,
    int recentWorkedDays,
    BigDecimal recentWorkFrequency,
    BigDecimal averageGrossPerWorkedDay,
    StatisticsConfidence confidence,
    boolean available,
    ForecastUnavailableReason reason) {}
