package com.alveryn.api.workrecord.line.dto;

import com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record WorkRecordLineResponse(
    UUID id,
    UUID workTypeId,
    int displayOrder,
    String workTypeName,
    String configurationName,
    WorkLineCalculationMode calculationMode,
    String unitLabel,
    String unitSymbol,
    BigDecimal quantity,
    BigDecimal fixedAmountSnapshot,
    BigDecimal unitsPerHourSnapshot,
    LocalTime startTime,
    LocalTime endTime,
    Integer durationMinutes,
    Integer breakMinutes,
    BigDecimal calculatedMinutes,
    BigDecimal workedHours,
    BigDecimal hourlyRateSnapshot,
    BigDecimal ratePerUnitSnapshot,
    String currencySnapshot,
    BigDecimal grossAmount,
    int extraPayPercentage,
    String notes) {}
