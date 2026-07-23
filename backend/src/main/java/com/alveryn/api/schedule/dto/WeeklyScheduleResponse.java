package com.alveryn.api.schedule.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WeeklyScheduleResponse(UUID id, UUID employmentId, String name, String timezone,
    LocalDate validFrom, LocalDate validTo, int version, List<ScheduleRuleResponse> rules) {}
