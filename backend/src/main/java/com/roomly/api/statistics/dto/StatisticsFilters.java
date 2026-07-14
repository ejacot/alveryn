package com.roomly.api.statistics.dto;

import com.roomly.api.worktype.entity.CalculationMethod;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StatisticsFilters(
    @NotNull LocalDate from,
    @NotNull LocalDate to,
    List<UUID> workTypeIds,
    List<CalculationMethod> calculationMethods,
    String timezone) {}
