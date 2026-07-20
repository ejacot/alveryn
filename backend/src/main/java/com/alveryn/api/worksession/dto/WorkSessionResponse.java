package com.alveryn.api.worksession.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WorkSessionResponse(UUID id, UUID employmentId, String employmentName, UUID workTypeId,
    String workTypeName, int defaultBreakMinutes, OffsetDateTime checkedInAt, OffsetDateTime checkedOutAt, String timezone,
    int breakMinutes, String notes, UUID workRecordId, OffsetDateTime pauseStartedAt,
    long accumulatedBreakSeconds, boolean overdue) {}
