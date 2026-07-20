package com.alveryn.api.absence.dto;

import com.alveryn.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Absence request")
public record AbsenceRequest(
    @NotNull UUID employmentId,
    UUID absenceTypeId,
    AbsenceType absenceType,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @Size(max = 500) String notes) {}
