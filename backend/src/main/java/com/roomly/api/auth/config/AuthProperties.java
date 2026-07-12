package com.roomly.api.auth.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "roomly.auth")
public record AuthProperties(
    @NotBlank String jwtSecret,
    Duration accessTokenLifetime,
    Duration refreshTokenLifetime,
    Duration emailVerificationCodeLifetime,
    Duration passwordResetCodeLifetime,
    Duration verificationResendCooldown,
    @Min(1) int loginMaxFailedAttempts,
    Duration loginLockDuration,
    String frontendVerificationUrl,
    boolean devExposeCodes) {}
