package com.alveryn.api.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateBusinessOrganizationRequest(
    @NotBlank @Size(max = 160) String name,
    @NotBlank @Size(max = 60) String timezone) {}
