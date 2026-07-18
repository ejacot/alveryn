package com.alveryn.api.absence.dto;

import com.alveryn.api.absence.entity.AbsenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Absence type configuration request")
public record AbsenceTypeSettingRequest(
    @NotBlank @Size(max = 80) String name,
    AbsenceType code,
    @NotNull Boolean paid,
    @Min(0) @Max(1440) Integer paidMinutesPerDay,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
    Boolean active,
    @Min(0) Integer displayOrder) {}
