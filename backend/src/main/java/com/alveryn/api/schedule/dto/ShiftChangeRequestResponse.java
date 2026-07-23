package com.alveryn.api.schedule.dto;
import com.alveryn.api.schedule.entity.*;
import java.time.OffsetDateTime;
import java.util.UUID;
public record ShiftChangeRequestResponse(UUID id, UUID assignmentId, String employeeEmail,
    ShiftChangeRequestType type, ShiftChangeRequestStatus status, OffsetDateTime currentStart,
    OffsetDateTime currentEnd, OffsetDateTime proposedStart, OffsetDateTime proposedEnd,
    String reason, OffsetDateTime decidedAt) {}
