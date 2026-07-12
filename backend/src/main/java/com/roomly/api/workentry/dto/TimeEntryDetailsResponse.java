package com.roomly.api.workentry.dto;

import java.time.LocalTime;

public record TimeEntryDetailsResponse(
    LocalTime startTime,
    LocalTime endTime,
    int breakMinutes,
    int totalIntervalMinutes,
    int workedMinutes) {}
