package com.alveryn.api.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "alveryn.auth.oauth.google")
public record GoogleOAuthProperties(
    String clientId,
    String clientSecret,
    String redirectUri,
    String frontendSuccessUrl,
    String frontendFailureUrl) {

  public boolean enabled() {
    return hasText(clientId) && hasText(clientSecret) && hasText(redirectUri);
  }

  public String successUrl() {
    return hasText(frontendSuccessUrl) ? frontendSuccessUrl.trim() : "http://localhost:5173/auth/oauth/callback";
  }

  public String failureUrl() {
    return hasText(frontendFailureUrl) ? frontendFailureUrl.trim() : "http://localhost:5173/login?oauth=error";
  }

  private static boolean hasText(String value) {
    return value != null && !value.trim().isEmpty();
  }
}
