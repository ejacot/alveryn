package com.alveryn.api.schedule.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record ScheduleRuleResponse(UUID id, com.alveryn.api.schedule.entity.ScheduleItemType itemType,
    UUID workTypeId, String workTypeName, String workTypeColor,
    UUID absenceTypeId, String absenceTypeName, String absenceTypeColor,
    DayOfWeek dayOfWeek, LocalTime startTime,
    LocalTime endTime, int breakMinutes) {}
