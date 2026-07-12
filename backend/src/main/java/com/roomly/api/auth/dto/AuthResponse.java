package com.roomly.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(description = "Authentication token response")
public record AuthResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long accessTokenExpiresIn,
    OffsetDateTime refreshTokenExpiresAt,
    AuthUserResponse user) {}
