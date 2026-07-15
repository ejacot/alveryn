package com.roomly.api.auth.controller;

import com.roomly.api.auth.config.GoogleOAuthProperties;
import com.roomly.api.auth.dto.*;
import com.roomly.api.auth.service.AuthService;
import com.roomly.api.auth.service.GoogleOAuthService;
import com.roomly.api.auth.service.RefreshTokenCookieService;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration, verification, login and password recovery")
public class AuthController {
  private static final String GOOGLE_STATE_COOKIE = "roomly_google_oauth_state";

  private final AuthService authService;
  private final GoogleOAuthService googleOAuthService;
  private final GoogleOAuthProperties googleOAuthProperties;
  private final RefreshTokenCookieService refreshTokenCookieService;
  private final SecureRandom secureRandom;

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Register a new user",
      description =
          "Creates a new account, normalizes the email, hashes the password and triggers email verification.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Registration succeeded",
        content = @Content(schema = @Schema(implementation = AuthUserResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Email already exists",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<AuthUserResponse> register(@Valid @RequestBody RegisterRequest request) {
    return ApiResponse.of(authService.register(request));
  }

  @PostMapping("/verify-email")
  @Operation(
      summary = "Verify email address",
      description = "Validates the verification code for the given email address and marks the account as verified.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Email verified"),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Invalid or expired verification code",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<GenericSuccessResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
    return ApiResponse.of(authService.verifyEmail(request));
  }

  @PostMapping("/resend-verification")
  @Operation(
      summary = "Resend verification code",
      description =
          "Triggers a new email verification code for an unverified account without revealing whether the account exists.")
  public ApiResponse<GenericSuccessResponse> resendVerification(
      @Valid @RequestBody ResendVerificationRequest request) {
    return ApiResponse.of(authService.resendVerificationCode(request));
  }

  @PostMapping("/login")
  @Operation(
      summary = "Log in",
      description =
          "Authenticates verified credentials, returns a JWT access token and stores the rotated refresh token in an HttpOnly cookie.")
  public ApiResponse<AuthResponse> login(
      @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    IssuedAuthSession session = authService.login(request);
    refreshTokenCookieService.writeRefreshToken(response, session.refreshToken());
    return ApiResponse.of(session.response());
  }

  @GetMapping("/oauth/google/start")
  @Operation(
      summary = "Start Google sign-in",
      description = "Redirects the browser to Google's OAuth consent flow.")
  public void startGoogleOAuth(HttpServletResponse response) throws IOException {
    if (!googleOAuthProperties.enabled()) {
      response.sendRedirect(failureRedirectUrl());
      return;
    }
    String state = generateState();
    response.addHeader(HttpHeaders.SET_COOKIE, oauthStateCookie(state, false).toString());
    String authorizationUrl =
        UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
            .queryParam("client_id", googleOAuthProperties.clientId())
            .queryParam("redirect_uri", googleOAuthProperties.redirectUri())
            .queryParam("response_type", "code")
            .queryParam("scope", "openid email profile")
            .queryParam("state", state)
            .build()
            .encode()
            .toUriString();
    response.sendRedirect(authorizationUrl);
  }

  @GetMapping("/oauth/google/callback")
  @Operation(
      summary = "Complete Google sign-in",
      description = "Validates the OAuth state, provisions or links the account, then redirects to the frontend callback.")
  public void completeGoogleOAuth(
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String state,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    try {
      validateState(request, state);
      if (code == null || code.isBlank()) {
        throw new ValidationException("Google authorization code is missing", "GOOGLE_OAUTH_FAILED");
      }
      IssuedAuthSession session = googleOAuthService.authenticate(code);
      refreshTokenCookieService.writeRefreshToken(response, session.refreshToken());
      response.addHeader(HttpHeaders.SET_COOKIE, oauthStateCookie("", true).toString());
      response.sendRedirect(googleOAuthProperties.successUrl());
    } catch (RuntimeException error) {
      response.addHeader(HttpHeaders.SET_COOKIE, oauthStateCookie("", true).toString());
      response.sendRedirect(failureRedirectUrl());
    }
  }

  @PostMapping("/refresh")
  @Operation(
      summary = "Refresh tokens",
      description = "Validates the refresh-token cookie, rotates it and returns a new access token.")
  public ApiResponse<AuthResponse> refresh(
      HttpServletRequest request, HttpServletResponse response) {
    IssuedAuthSession session =
        authService.refresh(refreshTokenCookieService.extractRefreshToken(request));
    refreshTokenCookieService.writeRefreshToken(response, session.refreshToken());
    return ApiResponse.of(session.response());
  }

  @PostMapping("/logout")
  @Operation(
      summary = "Log out",
      description = "Revokes the refresh-token cookie. The operation is idempotent and returns a generic success response.")
  public ApiResponse<GenericSuccessResponse> logout(
      HttpServletRequest request, HttpServletResponse response) {
    GenericSuccessResponse result =
        authService.logout(refreshTokenCookieService.extractRefreshToken(request));
    refreshTokenCookieService.clearRefreshToken(response);
    return ApiResponse.of(result);
  }

  private void validateState(HttpServletRequest request, String state) {
    String expected =
        request.getCookies() == null
            ? null
            : Arrays.stream(request.getCookies())
                .filter(cookie -> GOOGLE_STATE_COOKIE.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    if (state == null || state.isBlank() || expected == null || !expected.equals(state)) {
      throw new ValidationException("Google sign-in state is invalid", "GOOGLE_OAUTH_INVALID_STATE");
    }
  }

  private String failureRedirectUrl() {
    String separator = googleOAuthProperties.failureUrl().contains("?") ? "&" : "?";
    return googleOAuthProperties.failureUrl()
        + separator
        + "oauthError="
        + URLEncoder.encode("google", StandardCharsets.UTF_8);
  }

  private String generateState() {
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private ResponseCookie oauthStateCookie(String value, boolean expired) {
    return ResponseCookie.from(GOOGLE_STATE_COOKIE, value)
        .httpOnly(true)
        .secure(
            googleOAuthProperties.redirectUri() != null
                && googleOAuthProperties.redirectUri().startsWith("https://"))
        .sameSite("Lax")
        .path("/api/auth/oauth/google")
        .maxAge(expired ? Duration.ZERO : Duration.ofMinutes(10))
        .build();
  }

  @PostMapping("/forgot-password")
  @Operation(
      summary = "Request password reset",
      description =
          "Generates a password reset flow for an existing account and always returns a generic success response.")
  public ApiResponse<GenericSuccessResponse> forgotPassword(
      @Valid @RequestBody ForgotPasswordRequest request) {
    return ApiResponse.of(authService.forgotPassword(request));
  }

  @PostMapping("/reset-password")
  @Operation(
      summary = "Reset password",
      description = "Validates the reset code, updates the password hash and revokes the user's active refresh tokens.")
  public ApiResponse<GenericSuccessResponse> resetPassword(
      @Valid @RequestBody ResetPasswordRequest request, HttpServletResponse response) {
    GenericSuccessResponse result = authService.resetPassword(request);
    refreshTokenCookieService.clearRefreshToken(response);
    return ApiResponse.of(result);
  }
}
