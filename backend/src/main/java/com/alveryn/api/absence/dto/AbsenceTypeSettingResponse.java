package com.alveryn.api.absence.dto;

import com.alveryn.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Absence type configuration")
public record AbsenceTypeSettingResponse(
    UUID id,
    String name,
    AbsenceType code,
    boolean paid,
    int paidMinutesPerDay,
    String color,
    boolean active,
    int displayOrder,
    boolean deletable) {}
