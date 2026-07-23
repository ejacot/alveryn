package com.alveryn.api.schedule.dto;
import com.alveryn.api.schedule.entity.ShiftChangeRequestType;
import jakarta.validation.constraints.*;
import java.time.*;
public record ShiftChangeRequestPayload(@NotNull ShiftChangeRequestType type,
    LocalDate date, LocalTime startTime, LocalTime endTime, @Size(max=500) String reason) {}
