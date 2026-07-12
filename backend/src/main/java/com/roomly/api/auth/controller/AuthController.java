package com.roomly.api.auth.controller;

import com.roomly.api.auth.dto.*;
import com.roomly.api.auth.service.AuthService;
import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration, verification, login and password recovery")
public class AuthController {
  private final AuthService authService;

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
          "Authenticates verified credentials and returns a JWT access token together with a rotated opaque refresh token.")
  public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
    return ApiResponse.of(authService.login(request));
  }

  @PostMapping("/refresh")
  @Operation(
      summary = "Refresh tokens",
      description = "Validates the refresh token, rotates it and returns a new access token and refresh token pair.")
  public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
    return ApiResponse.of(authService.refresh(request));
  }

  @PostMapping("/logout")
  @Operation(
      summary = "Log out",
      description = "Revokes the submitted refresh token. The operation is idempotent and returns a generic success response.")
  public ApiResponse<GenericSuccessResponse> logout(@Valid @RequestBody RefreshTokenRequest request) {
    return ApiResponse.of(authService.logout(request));
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
      @Valid @RequestBody ResetPasswordRequest request) {
    return ApiResponse.of(authService.resetPassword(request));
  }
}
