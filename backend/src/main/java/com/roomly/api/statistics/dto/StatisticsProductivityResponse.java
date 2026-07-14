package com.roomly.api.statistics.dto;

import java.math.BigDecimal;
import java.util.List;

public record StatisticsProductivityResponse(
    BigDecimal totalUnits,
    BigDecimal equivalentMinutes,
    BigDecimal actualMinutes,
    BigDecimal configuredUnitsPerHour,
    BigDecimal actualUnitsPerHour,
    BigDecimal performancePercentage,
    boolean actualProductivityAvailable,
    boolean available,
    List<StatisticsProductivityUnitTypeResponse> unitTypes,
    StatisticsGranularity granularity,
    ProductivityMetric metric,
    List<StatisticsProductivityPointResponse> points) {}
