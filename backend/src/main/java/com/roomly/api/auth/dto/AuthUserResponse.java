package com.roomly.api.auth.dto;

import com.roomly.api.user.entity.UserStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AuthUserResponse(
    UUID id, String email, boolean emailVerified, UserStatus status, OffsetDateTime lastLoginAt) {}
