package com.roomly.api.auth.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "refresh_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(name = "token_hash", nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false)
  private OffsetDateTime expiresAt;

  @Column(name = "revoked_at")
  private OffsetDateTime revokedAt;

  @Column(name = "replaced_by_token_id")
  private UUID replacedByTokenId;

  public RefreshToken(UserAccount user, String tokenHash, OffsetDateTime expiresAt) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.tokenHash = required(tokenHash, "tokenHash");
    this.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt is required");
  }

  public boolean isActive(OffsetDateTime now) {
    return revokedAt == null && expiresAt.isAfter(now);
  }

  public void revoke(OffsetDateTime revokedAt, UUID replacementId) {
    this.revokedAt = Objects.requireNonNull(revokedAt, "revokedAt is required");
    this.replacedByTokenId = replacementId;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " is required");
    }
    return value.trim();
  }
}
