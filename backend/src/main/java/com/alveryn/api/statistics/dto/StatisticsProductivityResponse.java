package com.alveryn.api.statistics.dto;

import java.math.BigDecimal;
import java.util.List;

public record StatisticsProductivityResponse(
    BigDecimal totalUnits,
    BigDecimal equivalentMinutes,
    BigDecimal actualMinutes,
    BigDecimal effectiveConfiguredUnitsPerHour,
    BigDecimal actualUnitsPerHour,
    BigDecimal performancePercentage,
    boolean actualProductivityAvailable,
    boolean available,
    boolean partial,
    int incompleteItems,
    List<StatisticsProductivityUnitTypeResponse> unitTypes,
    ProductivityGrouping grouping,
    StatisticsGranularity granularity,
    ProductivityMetric metric,
    List<StatisticsProductivityPointResponse> points) {}
