package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

@Schema(description = "Inclusive statistics period")
public record StatisticsPeriodRequest(@NotNull LocalDate from, @NotNull LocalDate to) {}
