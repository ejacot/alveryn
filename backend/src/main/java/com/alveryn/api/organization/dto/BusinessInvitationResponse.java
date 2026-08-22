package com.alveryn.api.organization.dto;

import java.time.OffsetDateTime;

public record BusinessInvitationResponse(
    String organizationName, String invitedEmail, OffsetDateTime expiresAt, String status) {}
