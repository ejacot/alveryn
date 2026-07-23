package com.alveryn.api.schedule.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public record WeeklyScheduleRequest(
    @Size(max = 120) String name,
    @NotBlank @Size(max = 60) String timezone,
    @NotNull LocalDate validFrom,
    LocalDate validTo,
    @NotEmpty @Size(max = 70) List<@Valid ScheduleRuleRequest> rules) {}
