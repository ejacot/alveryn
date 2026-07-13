package com.roomly.api.auth.dto;

public record IssuedAuthSession(AuthResponse response, String refreshToken) {}
