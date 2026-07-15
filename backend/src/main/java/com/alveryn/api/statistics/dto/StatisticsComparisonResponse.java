package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Previous-period comparison for the selected statistics filters")
public record StatisticsComparisonResponse(
    boolean available,
    BigDecimal percentage,
    ComparisonDirection direction,
    List<MoneyAmountResponse> grossByCurrency) {}
