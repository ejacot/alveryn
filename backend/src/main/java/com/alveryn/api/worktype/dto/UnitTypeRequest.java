package com.alveryn.api.worktype.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Schema(description = "Unit type request")
public record UnitTypeRequest(
    @NotBlank @Size(max = 100) String name,
    @Positive BigDecimal unitsPerHour,
    @Size(max = 20) String symbol,
    @Positive BigDecimal ratePerUnit,
    @Size(min = 3, max = 3) String currency,
    @PositiveOrZero Integer displayOrder,
    boolean active) {
  public UnitTypeRequest(
      String name, BigDecimal unitsPerHour, Integer displayOrder, boolean active) {
    this(name, unitsPerHour, null, null, null, displayOrder, active);
  }
}
