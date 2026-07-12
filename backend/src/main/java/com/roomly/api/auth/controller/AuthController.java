package com.roomly.api.auth.controller;

import com.roomly.api.auth.dto.*;
import com.roomly.api.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
  private final AuthService authService;

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthUserResponse register(@Valid @RequestBody RegisterRequest request) {
    return authService.register(request);
  }

  @PostMapping("/verify-email")
  public GenericSuccessResponse verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
    return authService.verifyEmail(request);
  }

  @PostMapping("/resend-verification")
  public GenericSuccessResponse resendVerification(
      @Valid @RequestBody ResendVerificationRequest request) {
    return authService.resendVerificationCode(request);
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request);
  }

  @PostMapping("/refresh")
  public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
    return authService.refresh(request);
  }

  @PostMapping("/logout")
  public GenericSuccessResponse logout(@Valid @RequestBody RefreshTokenRequest request) {
    return authService.logout(request);
  }

  @PostMapping("/forgot-password")
  public GenericSuccessResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
    return authService.forgotPassword(request);
  }

  @PostMapping("/reset-password")
  public GenericSuccessResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
    return authService.resetPassword(request);
  }
}
