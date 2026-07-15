package com.alveryn.api.auth.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "password_reset_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PasswordResetToken extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(name = "token_hash", nullable = false, length = 255)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false)
  private OffsetDateTime expiresAt;

  @Column(name = "used_at")
  private OffsetDateTime usedAt;

  public PasswordResetToken(UserAccount user, String tokenHash, OffsetDateTime expiresAt) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.tokenHash = required(tokenHash, "tokenHash");
    this.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt is required");
  }

  public boolean isActive(OffsetDateTime now) {
    return usedAt == null && expiresAt.isAfter(now);
  }

  public void markUsed(OffsetDateTime at) {
    usedAt = Objects.requireNonNull(at, "at is required");
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " is required");
    }
    return value.trim();
  }
}
