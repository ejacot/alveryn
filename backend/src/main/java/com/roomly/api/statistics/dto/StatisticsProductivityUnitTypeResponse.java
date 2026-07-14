package com.roomly.api.statistics.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record StatisticsProductivityUnitTypeResponse(
    UUID unitTypeId,
    String name,
    String workTypeName,
    BigDecimal totalQuantity,
    BigDecimal equivalentMinutes,
    BigDecimal actualMinutes,
    BigDecimal configuredUnitsPerHour,
    BigDecimal actualUnitsPerHour,
    BigDecimal performancePercentage,
    boolean actualProductivityAvailable,
    int entries,
    BigDecimal percentageOfTotalUnits) {}
