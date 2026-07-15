package com.alveryn.api.worktype.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.UUID;

@Schema(description = "Unit type definition used by UNIT_BASED work entries")
public record UnitTypeResponse(
    UUID id,
    UUID workTypeId,
    String name,
    BigDecimal unitsPerHour,
    String symbol,
    BigDecimal ratePerUnit,
    String currency,
    int displayOrder,
    boolean active) {}
