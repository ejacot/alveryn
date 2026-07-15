package com.alveryn.api.worktype.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Work type definition used for work entry classification")
public record WorkTypeResponse(
    UUID id,
    String name,
    CalculationMethod calculationMethod,
    String color,
    String icon,
    Integer defaultBreakMinutes,
    int displayOrder,
    boolean active) {}
