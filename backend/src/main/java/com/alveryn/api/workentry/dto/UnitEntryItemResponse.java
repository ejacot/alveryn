package com.alveryn.api.workentry.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record UnitEntryItemResponse(
    UUID id,
    UUID unitTypeId,
    String unitName,
    BigDecimal quantity,
    Integer displayOrder,
    BigDecimal unitsPerHourSnapshot,
    BigDecimal calculatedMinutes) {}
