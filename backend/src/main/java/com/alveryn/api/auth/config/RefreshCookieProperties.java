package com.alveryn.api.auth.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "alveryn.auth.refresh-cookie")
public record RefreshCookieProperties(
    @NotBlank String name,
    @NotBlank String path,
    @NotBlank String sameSite,
    boolean secure) {
  public RefreshCookieProperties {
    name = name == null || name.isBlank() ? "alveryn_refresh_token" : name;
    path = path == null || path.isBlank() ? "/api/auth" : path;
    sameSite = sameSite == null || sameSite.isBlank() ? "Lax" : sameSite;
  }
}
