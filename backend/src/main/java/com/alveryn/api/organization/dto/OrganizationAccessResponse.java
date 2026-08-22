package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.OrganizationPermission;
import java.util.Set;

public record OrganizationAccessResponse(Set<OrganizationPermission> permissions) {}
