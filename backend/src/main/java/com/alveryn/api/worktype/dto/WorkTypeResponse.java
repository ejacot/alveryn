package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.UUID;

@Schema(description = "Work type definition used for work record line classification")
public record WorkTypeResponse(
    UUID id,
    UUID employmentId,
    UUID parentId,
    String name,
    CalculationMethod calculationMethod,
    CompensationMethod compensationMethod,
    String unitLabel,
    String unitSymbol,
    BigDecimal unitsPerHour,
    BigDecimal ratePerUnit,
    String currency,
    boolean teamworkEnabled,
    boolean extraPayEnabled,
    boolean compositeEnabled,
    String color,
    String icon,
    Integer defaultBreakMinutes,
    int displayOrder,
    boolean active,
    boolean deletable) {}
