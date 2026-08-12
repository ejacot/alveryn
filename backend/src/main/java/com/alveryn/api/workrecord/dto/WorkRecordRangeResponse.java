package com.alveryn.api.workrecord.dto;

import com.alveryn.api.workrecord.line.dto.WorkRecordLineResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WorkRecordRangeResponse(
    UUID id,
    UUID employmentId,
    LocalDate workDate,
    LocalDate workEndDate,
    Integer teamSize,
    BigDecimal calculatedMinutes,
    BigDecimal workedMinutes,
    BigDecimal extraPaidEquivalentMinutes,
    BigDecimal totalPaidEquivalentMinutes,
    BigDecimal grossAmount,
    BigDecimal baseGrossAmount,
    BigDecimal extraGrossAmount,
    BigDecimal totalGrossAmount,
    String currency,
    List<WorkRecordLineResponse> workLines) {

  public static WorkRecordRangeResponse from(WorkRecordResponse record) {
    return new WorkRecordRangeResponse(
        record.id(), record.employmentId(), record.workDate(), record.workEndDate(), record.teamSize(),
        record.calculatedMinutes(), record.workedMinutes(), record.extraPaidEquivalentMinutes(),
        record.totalPaidEquivalentMinutes(), record.grossAmount(), record.baseGrossAmount(),
        record.extraGrossAmount(), record.totalGrossAmount(), record.currency(), record.workLines());
  }
}
