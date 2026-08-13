package com.alveryn.api.organization.dto;

import java.util.UUID;

public record OrganizationRoleAssignmentResponse(UUID id, UUID membershipId, UUID roleId,
    UUID unitId, boolean includeDescendants) {}
