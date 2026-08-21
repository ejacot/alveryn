package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.OrganizationPermission;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record CreateOrganizationRoleRequest(
    @NotBlank @Size(max = 100) String name,
    @NotEmpty Set<OrganizationPermission> permissions) {}
