package com.roomly.api.workentry.dto;

import com.roomly.api.worktype.entity.CalculationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "Work entry response for the authenticated user")
public record WorkEntryResponse(
    UUID id,
    UUID workTypeId,
    String workTypeName,
    CalculationMethod calculationMethod,
    LocalDate workDate,
    BigDecimal hourlyRateSnapshot,
    String currencySnapshot,
    BigDecimal calculatedMinutes,
    BigDecimal workedHours,
    BigDecimal grossAmount,
    String notes,
    TimeEntryDetailsResponse timeEntry,
    List<UnitEntryItemResponse> unitItems,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
