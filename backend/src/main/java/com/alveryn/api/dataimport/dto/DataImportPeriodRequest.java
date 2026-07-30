package com.alveryn.api.dataimport.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record DataImportPeriodRequest(
    Integer year,
    Integer month,
    List<@Valid SheetPeriod> sheets) {

  public record SheetPeriod(
      @NotBlank String sheet,
      Integer year,
      Integer month) {}
}
