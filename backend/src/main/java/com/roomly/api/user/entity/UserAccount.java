package com.roomly.api.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "user_accounts")
public class UserAccount {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UserStatus status;

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

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UserAccount(String email, String passwordHash) {
        this.email = normalizeEmail(email);
        this.passwordHash = passwordHash;
        this.emailVerified = false;
        this.status = UserStatus.ACTIVE;
        this.failedLoginAttempts = 0;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public void updateEmail(String email) {
        this.email = normalizeEmail(email);
        touch();
    }

    public void updatePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        touch();
    }

    public void assignSecurityCode(
            String securityCodeHash,
            OffsetDateTime expiresAt
    ) {
        this.securityCodeHash = securityCodeHash;
        this.securityCodeExpiresAt = expiresAt;
        touch();
    }

    public void clearSecurityCode() {
        this.securityCodeHash = null;
        this.securityCodeExpiresAt = null;
        touch();
    }

    public boolean hasValidSecurityCode(OffsetDateTime now) {
        return securityCodeHash != null
                && securityCodeExpiresAt != null
                && securityCodeExpiresAt.isAfter(now);
    }

    public void verifyEmail() {
        this.emailVerified = true;
        clearSecurityCode();
    }

    public void registerFailedLogin() {
        this.failedLoginAttempts++;
        touch();
    }

    public void resetFailedLoginAttempts() {
        this.failedLoginAttempts = 0;
        this.lockedUntil = null;
        touch();
    }

    public void lockUntil(OffsetDateTime lockedUntil) {
        this.status = UserStatus.LOCKED;
        this.lockedUntil = lockedUntil;
        touch();
    }

    public void unlock() {
        this.status = UserStatus.ACTIVE;
        this.lockedUntil = null;
        this.failedLoginAttempts = 0;
        touch();
    }

    public void recordSuccessfulLogin(OffsetDateTime loginTime) {
        this.lastLoginAt = loginTime;
        this.failedLoginAttempts = 0;
        this.lockedUntil = null;
        touch();
    }

    private void touch() {
        this.updatedAt = OffsetDateTime.now();
    }

    private static String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }

        return email.trim().toLowerCase();
    }
}