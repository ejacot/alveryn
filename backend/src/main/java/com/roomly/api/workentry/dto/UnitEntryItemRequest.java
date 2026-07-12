package com.roomly.api.workentry.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.UUID;

@Schema(description = "Unit-based work item used inside a UNIT_BASED work entry request")
public record UnitEntryItemRequest(@NotNull UUID unitTypeId, @NotNull @Positive BigDecimal quantity) {}
