package com.roomly.api.workentry.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.UUID;

public record UnitEntryItemRequest(@NotNull UUID unitTypeId, @NotNull @Positive BigDecimal quantity) {}
