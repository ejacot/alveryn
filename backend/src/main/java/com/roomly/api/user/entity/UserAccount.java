package com.roomly.api.user.entity;

import com.roomly.api.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "user_accounts")
public class UserAccount extends BaseEntity {
  public static final Duration DEFAULT_SECURITY_CODE_VALIDITY = Duration.ofMinutes(5);

  @Column(nullable = false, unique = true, length = 255)
  private String email;

  @Column(name = "password_hash", nullable = false, length = 255)
  private String passwordHash;

  @Column(name = "email_verified", nullable = false)
  private boolean emailVerified;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private UserStatus status = UserStatus.ACTIVE;

  @Column(name = "security_code_hash", length = 255)
  private String securityCodeHash;

  @Column(name = "security_code_expires_at")
  private OffsetDateTime securityCodeExpiresAt;

  @Column(name = "failed_login_attempts", nullable = false)
  private int failedLoginAttempts;

  @Column(name = "locked_until")
  private OffsetDateTime lockedUntil;

  @Column(name = "last_login_at")
  private OffsetDateTime lastLoginAt;

  public UserAccount(String email, String passwordHash) {
    updateEmail(email);
    updatePasswordHash(passwordHash);
  }

  public void updateEmail(String value) {
    email = required(value, "email").toLowerCase(Locale.ROOT);
  }

  public void updatePasswordHash(String value) {
    passwordHash = required(value, "passwordHash");
  }

  public void assignSecurityCode(String hash, OffsetDateTime expiresAt) {
    OffsetDateTime expiry = Objects.requireNonNull(expiresAt, "expiresAt is required");
    if (!expiry.isAfter(OffsetDateTime.now()))
      throw new IllegalArgumentException("expiresAt must be in the future");
    securityCodeHash = required(hash, "securityCodeHash");
    securityCodeExpiresAt = expiry;
  }

  public void assignSecurityCode(String hash, OffsetDateTime now, Duration validity) {
    Objects.requireNonNull(now, "now is required");
    Duration duration = Objects.requireNonNull(validity, "validity is required");
    if (duration.isZero() || duration.isNegative())
      throw new IllegalArgumentException("validity must be positive");
    assignSecurityCode(hash, now.plus(duration));
  }

  public void clearSecurityCode() {
    securityCodeHash = null;
    securityCodeExpiresAt = null;
  }

  public boolean hasValidSecurityCode(OffsetDateTime now) {
    return now != null
        && securityCodeHash != null
        && securityCodeExpiresAt != null
        && securityCodeExpiresAt.isAfter(now);
  }

  public void verifyEmail() {
    emailVerified = true;
    clearSecurityCode();
  }

  public boolean isLockedAt(OffsetDateTime now) {
    return status == UserStatus.LOCKED && lockedUntil != null && now != null && lockedUntil.isAfter(now);
  }

  public boolean isDeleted() {
    return status == UserStatus.DELETED;
  }

  public void registerFailedLogin() {
    failedLoginAttempts++;
  }

  public void resetFailedLoginAttempts() {
    failedLoginAttempts = 0;
    lockedUntil = null;
  }

  public void lockUntil(OffsetDateTime until) {
    status = UserStatus.LOCKED;
    lockedUntil = Objects.requireNonNull(until, "until is required");
  }

  public void unlock() {
    status = UserStatus.ACTIVE;
    lockedUntil = null;
    failedLoginAttempts = 0;
  }

  public void recordSuccessfulLogin(OffsetDateTime at) {
    lastLoginAt = Objects.requireNonNull(at, "at is required");
    resetFailedLoginAttempts();
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " is required");
    return value.trim();
  }
}
