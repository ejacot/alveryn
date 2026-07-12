package com.roomly.api.absence.dto;

import com.roomly.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

@Schema(description = "Absence request")
public record AbsenceRequest(
    @NotNull AbsenceType absenceType,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @Size(max = 500) String notes) {}
