package com.alveryn.api.schedule.dto;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;
public record BusinessShiftRequest(@NotNull UUID membershipId, @NotNull UUID employmentId,
    @NotNull UUID activityId, @NotNull LocalDate date, @NotNull LocalTime startTime,
    @NotNull LocalTime endTime, @Min(0) Integer breakMinutes) {}
