package com.alveryn.api.schedule.dto;

import jakarta.validation.constraints.*;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record ScheduleRuleRequest(
    @NotNull com.alveryn.api.schedule.entity.ScheduleItemType itemType,
    UUID workTypeId,
    UUID absenceTypeId,
    @NotNull DayOfWeek dayOfWeek,
    @NotNull LocalTime startTime,
    @NotNull LocalTime endTime,
    @Min(0) int breakMinutes) {}
