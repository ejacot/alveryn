package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Aligned comparison chart point")
public record StatisticsComparisonSeriesPointResponse(
    String label,
    LocalDate periodABucketStart,
    LocalDate periodABucketEnd,
    LocalDate periodBBucketStart,
    LocalDate periodBBucketEnd,
    BigDecimal periodAValue,
    BigDecimal periodBValue,
    String currency) {}
