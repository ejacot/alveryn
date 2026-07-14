package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Advanced statistics comparison response")
public record StatisticsAdvancedComparisonResponse(
    StatisticsMetric metric,
    StatisticsPeriodTotalsResponse periodA,
    StatisticsPeriodTotalsResponse periodB,
    List<StatisticsComparisonDifferenceResponse> differences,
    StatisticsComparisonSeriesResponse series) {}
