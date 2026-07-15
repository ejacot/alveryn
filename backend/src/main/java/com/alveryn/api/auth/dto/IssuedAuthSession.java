package com.alveryn.api.auth.dto;

public record IssuedAuthSession(AuthResponse response, String refreshToken) {}
