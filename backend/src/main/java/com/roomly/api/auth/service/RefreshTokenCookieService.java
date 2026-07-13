package com.roomly.api.auth.service;

import com.roomly.api.auth.config.AuthProperties;
import com.roomly.api.auth.config.RefreshCookieProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RefreshTokenCookieService {
  private final RefreshCookieProperties properties;
  private final AuthProperties authProperties;

  public void writeRefreshToken(HttpServletResponse response, String token) {
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(token, false).toString());
  }

  public void clearRefreshToken(HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie("", true).toString());
  }

  public String extractRefreshToken(HttpServletRequest request) {
    if (request.getCookies() == null) {
      return null;
    }

    return Arrays.stream(request.getCookies())
        .filter(cookie -> properties.name().equals(cookie.getName()))
        .map(Cookie::getValue)
        .filter(value -> value != null && !value.isBlank())
        .findFirst()
        .orElse(null);
  }

  private ResponseCookie buildCookie(String token, boolean expired) {
    return ResponseCookie.from(properties.name(), token)
        .httpOnly(true)
        .secure(properties.secure())
        .sameSite(properties.sameSite())
        .path(properties.path())
        .maxAge(expired ? java.time.Duration.ZERO : authProperties.refreshTokenLifetime())
        .build();
  }
}
