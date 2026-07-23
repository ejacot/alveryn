package com.alveryn.api.organization.dto;
import jakarta.validation.constraints.*;
public record OrganizationRequest(@NotBlank @Size(max=160) String name,
    @NotBlank @Size(max=60) String timezone) {}
