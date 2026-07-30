package com.alveryn.api.dataimport.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record DataImportChatResponse(
    String status,
    String message,
    Proposal proposal) {

  public record Proposal(
      DataImportExecuteRequest.Action action,
      BigDecimal percentage,
      UUID targetWorkTypeId,
      BigDecimal eligibleHours,
      String confirmation) {}
}
