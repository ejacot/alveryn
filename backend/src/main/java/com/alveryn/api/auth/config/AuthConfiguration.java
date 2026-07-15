package com.alveryn.api.auth.config;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.Arrays;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.EnvironmentAware;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableConfigurationProperties({
  AuthProperties.class,
  GoogleOAuthProperties.class,
  RefreshCookieProperties.class,
  WebCorsProperties.class
})
public class AuthConfiguration implements EnvironmentAware {
  private static final String LOCAL_DEVELOPMENT_SECRET =
      "local-development-jwt-secret-32-bytes-minimum";

  private Environment environment;

  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  SecureRandom secureRandom() {
    return new SecureRandom();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  AuthPropertiesValidator authPropertiesValidator(AuthProperties properties) {
    return new AuthPropertiesValidator(properties, environment);
  }

  @Override
  public void setEnvironment(Environment environment) {
    this.environment = environment;
  }

  static final class AuthPropertiesValidator {
    AuthPropertiesValidator(AuthProperties properties, Environment environment) {
      String secret = properties.jwtSecret();
      if (secret == null || secret.isBlank()) {
        throw new IllegalStateException("alveryn.auth.jwt-secret must not be blank");
      }
      if (secret.length() < 32) {
        throw new IllegalStateException("alveryn.auth.jwt-secret must be at least 32 characters long");
      }

      boolean localProfileActive =
          Arrays.stream(environment.getActiveProfiles()).anyMatch("local"::equalsIgnoreCase);
      if (LOCAL_DEVELOPMENT_SECRET.equals(secret) && !localProfileActive) {
        throw new IllegalStateException(
            "The development JWT secret is allowed only when the local profile is active");
      }
    }
  }
}
