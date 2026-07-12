package com.roomly.api.auth.dto;

import java.time.OffsetDateTime;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long accessTokenExpiresIn,
    OffsetDateTime refreshTokenExpiresAt,
    AuthUserResponse user) {}
