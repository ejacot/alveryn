package com.alveryn.api.schedule.dto;
import com.alveryn.api.schedule.entity.*;
import java.time.OffsetDateTime;
import java.util.UUID;
public record BusinessShiftResponse(UUID shiftId, UUID assignmentId, UUID membershipId, String employeeEmail,
    UUID employmentId, String employmentName, UUID activityId, String activityName, String activityColor,
    OffsetDateTime startsAt, OffsetDateTime endsAt, int breakMinutes, ShiftStatus status,
    AssignmentStatus assignmentStatus, long plannedMinutes, long workedMinutes) {}
