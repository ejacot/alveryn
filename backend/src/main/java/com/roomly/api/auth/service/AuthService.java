package com.roomly.api.auth.service;

import com.roomly.api.auth.config.AuthProperties;
import com.roomly.api.auth.dto.*;
import com.roomly.api.auth.email.AuthenticationEmailService;
import com.roomly.api.auth.entity.RefreshToken;
import com.roomly.api.auth.exception.AuthenticationFailureException;
import com.roomly.api.auth.exception.EmailNotVerifiedException;
import com.roomly.api.auth.exception.ExpiredCodeException;
import com.roomly.api.auth.exception.UnauthorizedException;
import com.roomly.api.auth.security.JwtService;
import com.roomly.api.auth.util.AuthTokenGenerator;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserStatus;
import com.roomly.api.user.mapper.UserMapper;
import com.roomly.api.user.repository.UserAccountRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
  private static final Pattern EMAIL_PATTERN =
      Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

  private final UserAccountRepository users;
  private final UserMapper userMapper;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationEmailService emailService;
  private final AuthTokenGenerator tokenGenerator;
  private final AuthProperties properties;
  private final JwtService jwtService;
  private final RefreshTokenService refreshTokenService;
  private final PasswordResetService passwordResetService;
  private final Clock clock;

  @Transactional
  public AuthUserResponse register(RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ConflictException("An account with this email already exists");
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    String verificationCode = tokenGenerator.generateVerificationCode();
    UserAccount user = new UserAccount(email, passwordEncoder.encode(request.password()));
    user.assignSecurityCode(
        passwordEncoder.encode(verificationCode), now.plus(properties.emailVerificationCodeLifetime()));
    UserAccount saved = users.save(user);
    emailService.sendVerificationCode(saved, verificationCode);
    return toAuthUserResponse(saved);
  }

  @Transactional
  public GenericSuccessResponse verifyEmail(VerifyEmailRequest request) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(normalizeEmail(request.email()))
            .orElseThrow(() -> new AuthenticationFailureException("Invalid verification code"));
    if (user.isEmailVerified()) {
      return new GenericSuccessResponse("Email is already verified");
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    if (!user.hasValidSecurityCode(now)) {
      throw new ExpiredCodeException("Verification code has expired");
    }
    if (!passwordEncoder.matches(request.code(), user.getSecurityCodeHash())) {
      throw new AuthenticationFailureException("Invalid verification code");
    }
    user.verifyEmail();
    users.save(user);
    return new GenericSuccessResponse("Email verified successfully");
  }

  @Transactional
  public GenericSuccessResponse resendVerificationCode(ResendVerificationRequest request) {
    users.findByEmailIgnoreCase(normalizeEmail(request.email()))
        .filter(user -> !user.isEmailVerified())
        .ifPresent(this::resendVerificationCode);
    return new GenericSuccessResponse("If the account exists, a verification email has been sent");
  }

  @Transactional(noRollbackFor = AuthenticationFailureException.class)
  public AuthResponse login(LoginRequest request) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(normalizeEmail(request.email()))
            .orElseThrow(() -> invalidCredentials(null));
    OffsetDateTime now = OffsetDateTime.now(clock);
    if (user.isDeleted()) {
      throw invalidCredentials(user);
    }
    if (user.getStatus() == UserStatus.LOCKED && !user.isLockedAt(now)) {
      user.unlock();
    }
    if (user.isLockedAt(now)) {
      throw new UnauthorizedException("Account is temporarily locked");
    }
    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      user.registerFailedLogin();
      if (user.getFailedLoginAttempts() >= properties.loginMaxFailedAttempts()) {
        user.lockUntil(now.plus(properties.loginLockDuration()));
      }
      users.save(user);
      throw invalidCredentials(user);
    }
    if (!user.isEmailVerified()) {
      throw new EmailNotVerifiedException("Email verification is required");
    }
    user.recordSuccessfulLogin(now);
    users.save(user);
    return issueTokens(user);
  }

  @Transactional
  public AuthResponse refresh(RefreshTokenRequest request) {
    RefreshToken current =
        refreshTokenService.findByPlainToken(request.refreshToken());
    if (current == null) {
      throw new AuthenticationFailureException("Invalid refresh token");
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    if (!current.isActive(now)) {
      throw new AuthenticationFailureException("Invalid refresh token");
    }
    UserAccount user = current.getUser();
    if (user.isDeleted() || user.isLockedAt(now) || !user.isEmailVerified()) {
      throw new AuthenticationFailureException("Invalid refresh token");
    }
    RefreshTokenService.IssuedRefreshToken rotated = refreshTokenService.rotate(current);
    return buildAuthResponse(user, rotated);
  }

  @Transactional
  public GenericSuccessResponse logout(RefreshTokenRequest request) {
    refreshTokenService.revokeByPlainToken(request.refreshToken());
    return new GenericSuccessResponse("Logged out successfully");
  }

  @Transactional
  public GenericSuccessResponse forgotPassword(ForgotPasswordRequest request) {
    passwordResetService.forgotPassword(request.email());
    return new GenericSuccessResponse(
        "If the account exists, password reset instructions have been sent");
  }

  @Transactional
  public GenericSuccessResponse resetPassword(ResetPasswordRequest request) {
    passwordResetService.resetPassword(
        request.email(), request.code(), passwordEncoder.encode(request.newPassword()));
    return new GenericSuccessResponse("Password reset successfully");
  }

  private void resendVerificationCode(UserAccount user) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    if (user.hasValidSecurityCode(now)) {
      OffsetDateTime issuedAt = user.getSecurityCodeExpiresAt().minus(properties.emailVerificationCodeLifetime());
      if (issuedAt.plus(properties.verificationResendCooldown()).isAfter(now)) {
        return;
      }
    }
    String verificationCode = tokenGenerator.generateVerificationCode();
    user.assignSecurityCode(
        passwordEncoder.encode(verificationCode), now.plus(properties.emailVerificationCodeLifetime()));
    users.save(user);
    emailService.sendVerificationCode(user, verificationCode);
  }

  private AuthResponse issueTokens(UserAccount user) {
    return buildAuthResponse(user, refreshTokenService.issue(user));
  }

  private AuthResponse buildAuthResponse(
      UserAccount user, RefreshTokenService.IssuedRefreshToken refreshToken) {
    return new AuthResponse(
        jwtService.generateAccessToken(user),
        refreshToken.plainToken(),
        "Bearer",
        jwtService.getAccessTokenExpiresInSeconds(),
        refreshToken.persistedToken().getExpiresAt(),
        toAuthUserResponse(user));
  }

  private AuthUserResponse toAuthUserResponse(UserAccount user) {
    var dto = userMapper.toDto(user);
    return new AuthUserResponse(
        dto.id(), dto.email(), dto.emailVerified(), dto.status(), dto.lastLoginAt());
  }

  private AuthenticationFailureException invalidCredentials(UserAccount user) {
    return new AuthenticationFailureException("Invalid email or password");
  }

  private String normalizeEmail(String email) {
    String normalized = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    if (normalized == null || normalized.isBlank() || !EMAIL_PATTERN.matcher(normalized).matches()) {
      throw new ValidationException("email: must be a valid email address");
    }
    return normalized;
  }
}
