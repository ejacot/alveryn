package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "One local day in the statistics heatmap")
public record StatisticsHeatmapDayResponse(
    LocalDate date,
    BigDecimal value,
    BigDecimal workedMinutes,
    long entries,
    List<MoneyAmountResponse> grossByCurrency,
    boolean hasAbsence) {}
