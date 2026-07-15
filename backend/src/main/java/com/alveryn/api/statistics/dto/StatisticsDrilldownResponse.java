package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Statistics drill-down for a selected bucket")
public record StatisticsDrilldownResponse(
    LocalDate from,
    LocalDate to,
    StatisticsPeriodTotalsResponse totals,
    List<StatisticsWorkTypeResponse> workTypes) {}
