package com.alveryn.api.schedule.dto;

import com.alveryn.api.schedule.entity.AssignmentStatus;
import com.alveryn.api.schedule.entity.ShiftSource;
import com.alveryn.api.schedule.entity.ShiftStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ScheduledShiftResponse(UUID shiftId, UUID assignmentId, UUID employmentId,
    com.alveryn.api.schedule.entity.ScheduleItemType itemType,
    UUID workTypeId, String workTypeName, String workTypeColor,
    UUID absenceTypeId, String absenceTypeName, String absenceTypeColor,
    OffsetDateTime startsAt, OffsetDateTime endsAt, String timezone, int breakMinutes,
    ShiftStatus status, AssignmentStatus assignmentStatus, ShiftSource source) {}
