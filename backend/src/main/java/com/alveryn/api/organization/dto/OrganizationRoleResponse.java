package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.OrganizationPermission;
import java.util.Set;
import java.util.UUID;

public record OrganizationRoleResponse(UUID id, String name,
    Set<OrganizationPermission> permissions, boolean systemRole) {}
