package com.roomly.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
@Schema(description = "Authentication token response")
public record AuthResponse(
    String accessToken,
    String tokenType,
    long accessTokenExpiresIn,
    AuthUserResponse user) {}
