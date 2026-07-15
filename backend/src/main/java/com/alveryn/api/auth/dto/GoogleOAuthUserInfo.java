package com.alveryn.api.auth.dto;

public record GoogleOAuthUserInfo(
    String subject,
    String email,
    boolean emailVerified,
    String name,
    String givenName,
    String familyName,
    String picture) {}
