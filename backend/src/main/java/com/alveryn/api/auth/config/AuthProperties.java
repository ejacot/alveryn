package com.alveryn.api.auth.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "alveryn.auth")
public record AuthProperties(
    @NotBlank String jwtSecret,
    Duration accessTokenLifetime,
    Duration refreshTokenLifetime,
    Duration emailVerificationCodeLifetime,
    Duration passwordResetCodeLifetime,
    Duration verificationResendCooldown,
    @Min(1) int loginMaxFailedAttempts,
    Duration loginLockDuration,
    String frontendVerificationUrl) {
  public AuthProperties {
    requirePositive(accessTokenLifetime, "accessTokenLifetime");
    requirePositive(refreshTokenLifetime, "refreshTokenLifetime");
    requirePositive(emailVerificationCodeLifetime, "emailVerificationCodeLifetime");
    requirePositive(passwordResetCodeLifetime, "passwordResetCodeLifetime");
    requirePositive(verificationResendCooldown, "verificationResendCooldown");
    requirePositive(loginLockDuration, "loginLockDuration");
  }

  private static void requirePositive(Duration value, String name) {
    if (value == null || value.isZero() || value.isNegative()) {
      throw new IllegalArgumentException(name + " must be positive");
    }
  }
}
