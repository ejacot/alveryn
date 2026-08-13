package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.MembershipRole;
import com.alveryn.api.organization.entity.OrganizationType;
import java.util.UUID;

public record OrganizationResponse(UUID id, String name, OrganizationType type, String timezone,
                                   MembershipRole role) {}
