package com.alveryn.api.workrecord.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record WorkRecordLineRequest(
    UUID workTypeId,
    BigDecimal quantity,
    BigDecimal fixedAmount,
    @Size(min = 3, max = 3) String currency,
    LocalTime startTime,
    LocalTime endTime,
    @PositiveOrZero Integer durationMinutes,
    @PositiveOrZero Integer unpaidBreakMinutes,
    @PositiveOrZero @Max(1000) Integer extraPayPercentage,
    @Size(max = 500) String notes) {}
