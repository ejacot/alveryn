package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Work type definition used for work entry classification")
public record WorkTypeResponse(
    UUID id,
    String name,
    CalculationMethod calculationMethod,
    CompensationMethod compensationMethod,
    String color,
    String icon,
    Integer defaultBreakMinutes,
    int displayOrder,
    boolean active) {}
