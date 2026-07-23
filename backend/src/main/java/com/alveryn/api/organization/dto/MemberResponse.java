package com.alveryn.api.organization.dto;
import com.alveryn.api.organization.entity.*;
import java.time.OffsetDateTime;
import java.util.UUID;
public record MemberResponse(UUID membershipId, UUID userId, String email, MembershipRole role,
    MembershipStatus status, OffsetDateTime joinedAt) {}
