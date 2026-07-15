package com.alveryn.api.statistics.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

@Schema(description = "Statistics comparison request")
public record StatisticsComparisonRequest(
    @Valid @NotNull StatisticsPeriodRequest periodA,
    @Valid @NotNull StatisticsPeriodRequest periodB,
    @NotNull StatisticsMetric metric,
    List<UUID> workTypeIds,
    List<CalculationMethod> calculationMethods) {}
