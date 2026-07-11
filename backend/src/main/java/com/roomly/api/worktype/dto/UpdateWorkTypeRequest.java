package com.roomly.api.worktype.dto;

import jakarta.validation.constraints.*;

public record UpdateWorkTypeRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
    @Size(max = 100) String icon,
    @PositiveOrZero Integer defaultBreakMinutes,
    @PositiveOrZero int displayOrder,
    boolean active) {}
