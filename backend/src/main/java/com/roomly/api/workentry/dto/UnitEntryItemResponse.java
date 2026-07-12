package com.roomly.api.workentry.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record UnitEntryItemResponse(
    UUID id,
    UUID unitTypeId,
    String unitName,
    BigDecimal quantity,
    BigDecimal unitsPerHourSnapshot,
    BigDecimal calculatedMinutes) {}
