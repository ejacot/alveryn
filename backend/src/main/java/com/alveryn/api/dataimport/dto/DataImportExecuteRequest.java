package com.alveryn.api.dataimport.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DataImportExecuteRequest(
    @NotEmpty List<String> entryIds,
    Map<String, @Valid Resolution> resolutions) {
  public record Resolution(
      @NotNull Action action,
      @Positive @Max(1000) BigDecimal percentage,
      UUID targetWorkTypeId,
      @Positive BigDecimal eligibleHours) {}
  public enum Action {
    ENTER_PERCENTAGE,
    USE_EMPLOYMENT_RULE,
    ADD_AS_NOTE,
    USE_AS_INTERVAL,
    IGNORE
  }
}
