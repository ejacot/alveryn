package com.roomly.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.UUID;

@Schema(description = "Work type statistics breakdown item")
public record StatisticsWorkTypeResponse(
    UUID workTypeId,
    String name,
    BigDecimal minutes,
    BigDecimal gross,
    BigDecimal percentage,
    long entries) {}
