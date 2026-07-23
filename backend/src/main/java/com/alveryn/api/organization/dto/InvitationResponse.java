package com.alveryn.api.organization.dto;
import com.alveryn.api.organization.entity.MembershipRole;
import java.time.OffsetDateTime;
import java.util.UUID;
public record InvitationResponse(UUID id, UUID organizationId, String organizationName, String email,
    MembershipRole role, OffsetDateTime expiresAt, OffsetDateTime acceptedAt, OffsetDateTime revokedAt) {}
