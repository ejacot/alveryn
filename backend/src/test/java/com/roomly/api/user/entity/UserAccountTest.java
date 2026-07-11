package com.roomly.api.user.entity;

import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import static org.assertj.core.api.Assertions.assertThat;

class UserAccountTest {
    @Test void normalizesEmailAndTracksSecurityCodeLifecycle() {
        var now = OffsetDateTime.now();
        var user = new UserAccount("  Person@Example.COM ", "hash");
        user.assignSecurityCode("code-hash", now.plusMinutes(5));
        assertThat(user.getEmail()).isEqualTo("person@example.com");
        assertThat(user.hasValidSecurityCode(now.plusMinutes(4))).isTrue();
        assertThat(user.hasValidSecurityCode(now.plusMinutes(5))).isFalse();
        user.verifyEmail();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getSecurityCodeHash()).isNull();
        assertThat(user.getSecurityCodeExpiresAt()).isNull();
    }

    @Test void tracksFailedLoginsAndLockState() {
        var user = new UserAccount("person@example.com", "hash");
        user.registerFailedLogin();
        user.lockUntil(OffsetDateTime.now().plusMinutes(10));
        assertThat(user.getFailedLoginAttempts()).isOne();
        assertThat(user.getStatus()).isEqualTo(UserStatus.LOCKED);
        user.unlock();
        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }
}
