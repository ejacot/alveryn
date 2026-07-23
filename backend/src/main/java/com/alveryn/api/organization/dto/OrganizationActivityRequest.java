package com.alveryn.api.organization.dto;
import jakarta.validation.constraints.*;
public record OrganizationActivityRequest(@NotBlank @Size(max=100) String name,
    @Pattern(regexp="^#[0-9A-Fa-f]{6}$") String color,
    @Min(0) Integer defaultBreakMinutes, Boolean active, @Min(0) Integer displayOrder) {}
