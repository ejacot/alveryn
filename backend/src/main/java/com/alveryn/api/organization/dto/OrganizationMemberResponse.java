package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.MembershipStatus;
import java.util.UUID;

public record OrganizationMemberResponse(UUID id, UUID userId, String firstName, String lastName,
    String email, MembershipStatus status) {}
