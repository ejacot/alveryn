package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.CheckInMode;
import com.alveryn.api.organization.entity.OrganizationUnitType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateOrganizationUnitRequest(
    UUID parentId,
    @NotBlank @Size(max = 160) String name,
    @NotNull OrganizationUnitType type,
    @NotNull CheckInMode checkInMode,
    Integer displayOrder) {}
