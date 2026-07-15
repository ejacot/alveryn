package com.alveryn.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank @Size(max = 255) String email,
    @NotBlank @Size(max = 512) String code,
    @NotBlank @Size(min = 8, max = 128) String newPassword) {}
