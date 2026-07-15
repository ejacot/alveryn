package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Statistics activity heatmap")
public record StatisticsHeatmapResponse(
    StatisticsMetric metric,
    String currency,
    BigDecimal minimum,
    BigDecimal maximum,
    List<StatisticsHeatmapDayResponse> days) {}
