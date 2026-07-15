package com.alveryn.api.auth.util;

import java.security.SecureRandom;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthTokenGenerator {
  private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

  private final SecureRandom secureRandom;

  public String generateRefreshToken() {
    return generateOpaqueToken(32);
  }

  public String generatePasswordResetToken() {
    return generateOpaqueToken(32);
  }

  public String generateOpaqueToken() {
    return generateOpaqueToken(32);
  }

  public String generateVerificationCode() {
    return String.format("%06d", secureRandom.nextInt(1_000_000));
  }

  private String generateOpaqueToken(int size) {
    byte[] bytes = new byte[size];
    secureRandom.nextBytes(bytes);
    return URL_ENCODER.encodeToString(bytes);
  }
}
