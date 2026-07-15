package com.alveryn.api.auth.service;

import com.alveryn.api.auth.config.AuthProperties;
import com.alveryn.api.auth.email.AuthenticationEmailService;
import com.alveryn.api.auth.entity.PasswordResetToken;
import com.alveryn.api.auth.exception.AuthenticationFailureException;
import com.alveryn.api.auth.exception.ExpiredCodeException;
import com.alveryn.api.auth.repository.PasswordResetTokenRepository;
import com.alveryn.api.auth.util.AuthTokenGenerator;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.UserStatus;
import com.alveryn.api.user.repository.UserAccountRepository;
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
public class PasswordResetService {
  private static final Pattern EMAIL_PATTERN =
      Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

  private final UserAccountRepository users;
  private final PasswordResetTokenRepository tokens;
  private final AuthenticationEmailService emailService;
  private final AuthTokenGenerator tokenGenerator;
  private final PasswordEncoder passwordEncoder;
  private final RefreshTokenService refreshTokenService;
  private final AuthProperties properties;
  private final Clock clock;

  @Transactional
  public void forgotPassword(String email) {
    users.findByEmailIgnoreCase(normalizeEmail(email)).ifPresent(this::issueResetToken);
  }

  @Transactional
  public void resetPassword(String email, String plainToken, String newPasswordHash) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(normalizeEmail(email))
            .orElseThrow(() -> new AuthenticationFailureException("Invalid password reset code"));
    OffsetDateTime now = OffsetDateTime.now(clock);
    PasswordResetToken token =
        tokens.findAllByUser_IdOrderByCreatedAtDesc(user.getId()).stream()
            .filter(candidate -> passwordEncoder.matches(plainToken, candidate.getTokenHash()))
            .findFirst()
            .orElseThrow(() -> new AuthenticationFailureException("Invalid password reset code"));
    if (!token.getExpiresAt().isAfter(now)) {
      throw new ExpiredCodeException("Password reset code has expired");
    }
    if (token.getUsedAt() != null) {
      throw new AuthenticationFailureException("Invalid password reset code");
    }
    token.markUsed(now);
    tokens.save(token);
    user.updatePasswordHash(newPasswordHash);
    user.resetFailedLoginAttempts();
    if (user.getStatus() == UserStatus.LOCKED) {
      user.unlock();
    }
    users.save(user);
    refreshTokenService.revokeAllActiveForUser(user);
    tokens.markAllActiveAsUsed(user.getId(), now);
  }

  private void issueResetToken(UserAccount user) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    tokens.markAllActiveAsUsed(user.getId(), now);
    String plainToken = tokenGenerator.generatePasswordResetToken();
    PasswordResetToken token =
        new PasswordResetToken(
            user,
            passwordEncoder.encode(plainToken),
            now.plus(properties.passwordResetCodeLifetime()));
    tokens.save(token);
    emailService.sendPasswordResetCode(user, plainToken);
  }

  private String normalizeEmail(String email) {
    String normalized = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    if (normalized == null || normalized.isBlank() || !EMAIL_PATTERN.matcher(normalized).matches()) {
      throw new ValidationException("email: must be a valid email address");
    }
    return normalized;
  }
}
