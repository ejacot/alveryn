package com.roomly.api.statistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StatisticsProductivityPointResponse(
    LocalDate bucketStart,
    LocalDate bucketEnd,
    BigDecimal value,
    ProductivityMetric metric,
    boolean available) {}
