package com.alveryn.api.auth.service;

import com.alveryn.api.auth.config.AuthProperties;
import com.alveryn.api.admin.config.FounderProperties;
import com.alveryn.api.auth.dto.*;
import com.alveryn.api.auth.email.AuthenticationEmailService;
import com.alveryn.api.auth.exception.AuthenticationFailureException;
import com.alveryn.api.auth.exception.EmailNotVerifiedException;
import com.alveryn.api.auth.exception.ExpiredCodeException;
import com.alveryn.api.auth.exception.UnauthorizedException;
import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.auth.util.AuthTokenGenerator;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.entity.UserStatus;
import com.alveryn.api.user.mapper.UserMapper;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
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
  private final UserPreferencesRepository preferences;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationEmailService emailService;
  private final AuthTokenGenerator tokenGenerator;
  private final AuthProperties properties;
  private final JwtService jwtService;
  private final RefreshTokenService refreshTokenService;
  private final PasswordResetService passwordResetService;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final Clock clock;
  private final FounderProperties founderProperties;

  @Transactional
  public AuthUserResponse register(RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ConflictException("An account with this email already exists");
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    String verificationCode = tokenGenerator.generateVerificationCode();
    UserAccount user = new UserAccount(email, passwordEncoder.encode(request.password()));
    if (founderProperties.matches(email)) user.promoteToAdmin();
    user.assignSecurityCode(
        passwordEncoder.encode(verificationCode), now.plus(properties.emailVerificationCodeLifetime()));
    UserAccount saved = users.save(user);
    preferences.save(new UserPreferences(saved));
    emailService.sendVerificationCode(saved, verificationCode);
    return toAuthUserResponse(saved);
  }

  @Transactional
  public IssuedAuthSession verifyEmail(VerifyEmailRequest request) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(normalizeEmail(request.email()))
            .orElseThrow(() -> new AuthenticationFailureException("Invalid verification code"));
    if (user.isEmailVerified()) {
      return issueVerifiedSession(user);
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
    return issueVerifiedSession(user);
  }

  @Transactional
  public GenericSuccessResponse resendVerificationCode(ResendVerificationRequest request) {
    users.findByEmailIgnoreCase(normalizeEmail(request.email()))
        .filter(user -> !user.isEmailVerified())
        .ifPresent(this::resendVerificationCode);
    return new GenericSuccessResponse("If the account exists, a verification email has been sent");
  }

  @Transactional(noRollbackFor = AuthenticationFailureException.class)
  public IssuedAuthSession login(LoginRequest request) {
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
  public IssuedAuthSession refresh(String refreshToken) {
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    RefreshTokenService.IssuedRefreshToken rotated =
        refreshTokenService.rotate(
            refreshToken,
            user -> !user.isDeleted() && !user.isLockedAt(now) && user.isEmailVerified());
    return buildAuthSession(rotated.persistedToken().getUser(), rotated);
  }

  @Transactional
  public GenericSuccessResponse logout(String refreshToken) {
    if (refreshToken != null && !refreshToken.isBlank()) {
      refreshTokenService.revokeByPlainToken(refreshToken);
    }
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

  @Transactional
  public GenericSuccessResponse changePassword(ChangePasswordRequest request) {
    UserAccount user = users.findById(authenticatedUserAccessor.requireUserId())
        .orElseThrow(() -> new AuthenticationFailureException("Invalid current password"));
    if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
      throw new AuthenticationFailureException("Invalid current password");
    }
    if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
      throw new ValidationException("New password must be different from the current password");
    }
    user.updatePasswordHash(passwordEncoder.encode(request.newPassword()));
    users.save(user);
    return new GenericSuccessResponse("Password changed successfully");
  }

  @Transactional
  public IssuedAuthSession issueVerifiedSession(UserAccount user) {
    if (user.isDeleted()) {
      throw new AuthenticationFailureException("Invalid email or password");
    }
    if (!user.isEmailVerified()) {
      user.verifyEmail();
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    if (user.isLockedAt(now)) {
      throw new UnauthorizedException("Account is temporarily locked");
    }
    if (user.getStatus() == UserStatus.LOCKED) {
      user.unlock();
    }
    user.recordSuccessfulLogin(now);
    users.save(user);
    return issueTokens(user);
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

  private IssuedAuthSession issueTokens(UserAccount user) {
    return buildAuthSession(user, refreshTokenService.issue(user));
  }

  private IssuedAuthSession buildAuthSession(
      UserAccount user, RefreshTokenService.IssuedRefreshToken refreshToken) {
    return new IssuedAuthSession(
        new AuthResponse(
            jwtService.generateAccessToken(user),
            "Bearer",
            jwtService.getAccessTokenExpiresInSeconds(),
            toAuthUserResponse(user)),
        refreshToken.plainToken());
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
