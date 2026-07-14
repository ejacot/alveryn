package com.roomly.api.statistics.dto;

import java.math.BigDecimal;

public record StatisticsInsightResponse(
    InsightType type,
    ComparisonDirection direction,
    BigDecimal percentage,
    BigDecimal currentValue,
    BigDecimal previousValue,
    String currency,
    String subject,
    InsightSeverity severity,
    StatisticsConfidence confidence) {}
