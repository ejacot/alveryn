package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Aligned comparison chart series")
public record StatisticsComparisonSeriesResponse(
    StatisticsComparisonAlignment alignment,
    StatisticsGranularity granularity,
    List<StatisticsComparisonSeriesPointResponse> points) {}
