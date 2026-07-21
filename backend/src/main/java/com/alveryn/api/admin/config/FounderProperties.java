package com.alveryn.api.admin.config;

import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "alveryn.founder")
public record FounderProperties(String email) {
  public FounderProperties {
    email = normalize(email);
  }

  public boolean configured() {
    return email != null;
  }

  public boolean matches(String candidate) {
    return email != null && email.equals(normalize(candidate));
  }

  private static String normalize(String value) {
    if (value == null || value.isBlank()) return null;
    return value.trim().toLowerCase(Locale.ROOT);
  }
}
