package com.roomly.api.user.dto;

import com.roomly.api.user.entity.UserStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record UserAccountDto(
    UUID id, String email, boolean emailVerified, UserStatus status, OffsetDateTime lastLoginAt) {}
