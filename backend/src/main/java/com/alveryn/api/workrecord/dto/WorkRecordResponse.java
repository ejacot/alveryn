package com.alveryn.api.workrecord.dto;

import com.alveryn.api.address.dto.AddressResponse;
import com.alveryn.api.workrecord.line.dto.WorkRecordLineResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record WorkRecordResponse(
    UUID id,
    LocalDate workDate,
    LocalDate workEndDate,
    UUID addressId,
    AddressResponse address,
    Integer teamSize,
    String notes,
    BigDecimal calculatedMinutes,
    BigDecimal workedHours,
    BigDecimal workedMinutes,
    BigDecimal extraPaidEquivalentMinutes,
    BigDecimal totalPaidEquivalentMinutes,
    BigDecimal grossAmount,
    BigDecimal baseGrossAmount,
    BigDecimal extraGrossAmount,
    BigDecimal totalGrossAmount,
    String currency,
    List<WorkRecordLineResponse> workLines,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
