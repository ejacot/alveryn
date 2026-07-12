package com.roomly.api.user.dto;

import com.roomly.api.user.entity.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Safe user account representation")
public record UserAccountDto(
    UUID id, String email, boolean emailVerified, UserStatus status, OffsetDateTime lastLoginAt) {}
