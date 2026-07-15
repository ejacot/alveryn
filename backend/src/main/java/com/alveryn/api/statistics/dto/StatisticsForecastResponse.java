package com.alveryn.api.statistics.dto;

import java.time.LocalDate;
import java.util.List;

public record StatisticsForecastResponse(
    LocalDate from,
    LocalDate to,
    LocalDate asOf,
    ForecastMode mode,
    List<StatisticsForecastItemResponse> forecasts) {}
