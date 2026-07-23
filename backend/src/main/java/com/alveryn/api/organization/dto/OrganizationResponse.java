package com.alveryn.api.organization.dto;
import com.alveryn.api.organization.entity.*;
import java.util.UUID;
public record OrganizationResponse(UUID id, String name, OrganizationType type, String timezone,
    MembershipRole role, MembershipStatus membershipStatus) {}
