package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Difference between two comparison periods for one metric and optional currency")
public record StatisticsComparisonDifferenceResponse(
    String currency,
    BigDecimal periodAValue,
    BigDecimal periodBValue,
    BigDecimal absolute,
    BigDecimal percentage,
    ComparisonDirection direction,
    boolean available) {}
