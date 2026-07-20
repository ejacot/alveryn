package com.alveryn.api.absence.dto;

import com.alveryn.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Absence response")
public record AbsenceResponse(
    UUID id,
    UUID employmentId,
    String employmentName,
    UUID absenceTypeId,
    AbsenceType absenceType,
    String absenceTypeName,
    boolean paid,
    int paidMinutesPerDay,
    LocalDate startDate,
    LocalDate endDate,
    String notes) {}
