package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Aggregated totals for one statistics period")
public record StatisticsPeriodTotalsResponse(
    LocalDate from,
    LocalDate to,
    BigDecimal workedMinutes,
    int workedDays,
    long entries,
    List<MoneyAmountResponse> grossByCurrency,
    BigDecimal averageMinutesPerWorkedDay) {}
