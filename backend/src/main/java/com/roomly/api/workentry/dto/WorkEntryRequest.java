package com.roomly.api.workentry.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record WorkEntryRequest(
    @NotNull UUID workTypeId,
    @NotNull LocalDate workDate,
    LocalTime startTime,
    LocalTime endTime,
    @PositiveOrZero Integer unpaidBreakMinutes,
    List<@Valid UnitEntryItemRequest> unitItems,
    @Size(max = 500) String notes) {}
