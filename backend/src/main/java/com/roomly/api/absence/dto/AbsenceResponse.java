package com.roomly.api.absence.dto;

import com.roomly.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Absence response")
public record AbsenceResponse(
    UUID id, AbsenceType absenceType, LocalDate startDate, LocalDate endDate, String notes) {}
