package com.roomly.api.user.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class UserAccountTest {
  @Test
  void normalizesEmailAndTracksSecurityCodeLifecycle() {
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

  @Test
  void rejectsBlankCredentialsAndPastSecurityCodeExpiry() {
    assertThatIllegalArgumentException().isThrownBy(() -> new UserAccount(" ", "hash"));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new UserAccount("person@example.com", " "));
    var user = new UserAccount("person@example.com", "hash");
    assertThatIllegalArgumentException()
        .isThrownBy(
            () -> user.assignSecurityCode("code-hash", OffsetDateTime.now().minusSeconds(1)));
    assertThat(user.hasValidSecurityCode(null)).isFalse();
  }

  @Test
  void assigningNewCodeReplacesExistingCodeAndClearingRemovesBothValues() {
    var user = new UserAccount("person@example.com", "hash");
    var now = OffsetDateTime.now();
    user.assignSecurityCode("first", now.plusMinutes(5));
    user.assignSecurityCode("second", now.plusMinutes(10));
    assertThat(user.getSecurityCodeHash()).isEqualTo("second");
    user.clearSecurityCode();
    assertThat(user.getSecurityCodeHash()).isNull();
    assertThat(user.getSecurityCodeExpiresAt()).isNull();
  }

  @Test
  void tracksFailedLoginsAndLockState() {
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
