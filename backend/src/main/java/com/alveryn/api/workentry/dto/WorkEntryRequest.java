package com.alveryn.api.workentry.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Schema(
    description =
        "Work entry payload. TIME_BASED entries require startTime and endTime. UNIT_BASED entries require at least one unit item.")
public record WorkEntryRequest(
    @NotNull UUID workTypeId,
    @NotNull LocalDate workDate,
    LocalTime startTime,
    LocalTime endTime,
    @PositiveOrZero Integer unpaidBreakMinutes,
    @PositiveOrZero @Max(1000) Integer extraPayPercentage,
    List<@Valid UnitEntryItemRequest> unitItems,
    @Size(max = 500) String notes) {}
