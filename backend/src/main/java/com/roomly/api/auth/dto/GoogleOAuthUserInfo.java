package com.roomly.api.auth.dto;

public record GoogleOAuthUserInfo(
    String subject,
    String email,
    boolean emailVerified,
    String name,
    String givenName,
    String familyName,
    String picture) {}
