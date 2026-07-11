package com.roomly.api.user.entity;

import com.roomly.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.OffsetDateTime;
import java.util.Locale;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "user_accounts")
public class UserAccount extends BaseEntity {
    @Column(nullable = false, unique = true, length = 255) private String email;
    @Column(name = "password_hash", nullable = false, length = 255) private String passwordHash;
    @Column(name = "email_verified", nullable = false) private boolean emailVerified;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private UserStatus status = UserStatus.ACTIVE;
    @Column(name = "security_code_hash", length = 255) private String securityCodeHash;
    @Column(name = "security_code_expires_at") private OffsetDateTime securityCodeExpiresAt;
    @Column(name = "failed_login_attempts", nullable = false) private int failedLoginAttempts;
    @Column(name = "locked_until") private OffsetDateTime lockedUntil;
    @Column(name = "last_login_at") private OffsetDateTime lastLoginAt;

    public UserAccount(String email, String passwordHash) { updateEmail(email); updatePasswordHash(passwordHash); }
    public void updateEmail(String value) { email = normalizeRequired(value, "email").toLowerCase(Locale.ROOT); }
    public void updatePasswordHash(String value) { passwordHash = normalizeRequired(value, "passwordHash"); }
    public void assignSecurityCode(String hash, OffsetDateTime expiresAt) { securityCodeHash = normalizeRequired(hash, "hash"); securityCodeExpiresAt = java.util.Objects.requireNonNull(expiresAt); }
    public void assignSecurityCode(String hash, OffsetDateTime now, java.time.Duration validity) { assignSecurityCode(hash, now.plus(validity)); }
    public void clearSecurityCode() { securityCodeHash = null; securityCodeExpiresAt = null; }
    public boolean hasValidSecurityCode(OffsetDateTime now) { return securityCodeHash != null && securityCodeExpiresAt != null && securityCodeExpiresAt.isAfter(now); }
    public void verifyEmail() { emailVerified = true; clearSecurityCode(); }
    public void registerFailedLogin() { failedLoginAttempts++; }
    public void resetFailedLoginAttempts() { failedLoginAttempts = 0; lockedUntil = null; }
    public void lockUntil(OffsetDateTime until) { status = UserStatus.LOCKED; lockedUntil = java.util.Objects.requireNonNull(until); }
    public void unlock() { status = UserStatus.ACTIVE; lockedUntil = null; failedLoginAttempts = 0; }
    public void recordSuccessfulLogin(OffsetDateTime at) { lastLoginAt = java.util.Objects.requireNonNull(at); resetFailedLoginAttempts(); }
    private static String normalizeRequired(String value, String field) { if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(field + " is required"); return value.trim(); }
}
