package com.alveryn.api.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.YearMonth;

@Schema(description = "Current month dashboard summary")
public record DashboardResponse(
    @Schema(description = "Current month in YYYY-MM format", example = "2026-07") YearMonth currentMonth,
    @Schema(description = "Total worked hours stored with exact precision", example = "152.500000000000000")
        BigDecimal workedHours,
    @Schema(description = "Total worked minutes stored with exact precision", example = "9150.000000000000000")
        BigDecimal workedMinutes,
    @Schema(description = "Total gross amount stored with exact precision", example = "2537.500000000000000")
        BigDecimal grossAmount,
    @Schema(description = "Number of work entries in the current month", example = "18") long entriesCount,
    @Schema(description = "Number of absence days overlapping the current month", example = "2")
        long absenceDays) {}
