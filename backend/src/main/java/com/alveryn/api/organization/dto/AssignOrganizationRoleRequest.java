package com.alveryn.api.organization.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AssignOrganizationRoleRequest(
    @NotNull UUID membershipId,
    @NotNull UUID roleId,
    UUID unitId,
    Boolean includeDescendants) {}
