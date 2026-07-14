package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import com.roomly.api.worktype.entity.CalculationMethod;

@Schema(description = "Work type statistics breakdown item")
public record StatisticsWorkTypeResponse(
    UUID workTypeId,
    String name,
    CalculationMethod calculationMethod,
    BigDecimal minutes,
    List<MoneyAmountResponse> grossByCurrency,
    BigDecimal percentage,
    StatisticsPercentageBasis percentageBasis,
    long entries) {}
