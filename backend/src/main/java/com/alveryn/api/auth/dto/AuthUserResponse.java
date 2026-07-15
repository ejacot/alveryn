package com.alveryn.api.auth.dto;

import com.alveryn.api.user.entity.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Safe user summary returned from authentication flows")
public record AuthUserResponse(
    UUID id, String email, boolean emailVerified, UserStatus status, OffsetDateTime lastLoginAt) {}
