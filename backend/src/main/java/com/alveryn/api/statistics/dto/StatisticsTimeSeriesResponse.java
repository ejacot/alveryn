package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Complete statistics time series for the selected range and metric")
public record StatisticsTimeSeriesResponse(
    StatisticsGranularity granularity,
    StatisticsMetric metric,
    List<StatisticsTimeSeriesPointResponse> points) {}
