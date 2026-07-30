package com.alveryn.api.dataimport.dto;

import java.util.List;
import java.util.UUID;

public record DataImportConfirmResponse(
    UUID batchId,
    String status,
    int createdWorkTypes,
    int mappedWorkTypes,
    int ignoredColumns,
    List<Mapping> mappings) {
  public record Mapping(
      String sourceLabel,
      String semanticRole,
      UUID workTypeId,
      String workTypeName,
      java.math.BigDecimal extraPayPercentage) {}
}
