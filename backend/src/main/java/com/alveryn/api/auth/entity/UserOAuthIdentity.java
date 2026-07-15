package com.alveryn.api.auth.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
    name = "user_oauth_identities",
    uniqueConstraints = {
      @UniqueConstraint(name = "uk_user_oauth_identities_provider_subject", columnNames = {"provider", "provider_subject"}),
      @UniqueConstraint(name = "uk_user_oauth_identities_user_provider", columnNames = {"user_id", "provider"})
    })
public class UserOAuthIdentity extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private OAuthProvider provider;

  @Column(name = "provider_subject", nullable = false, length = 255)
  private String providerSubject;

  @Column(nullable = false, length = 255)
  private String email;

  @Column(name = "email_verified", nullable = false)
  private boolean emailVerified;

  public UserOAuthIdentity(
      UserAccount user,
      OAuthProvider provider,
      String providerSubject,
      String email,
      boolean emailVerified) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.provider = Objects.requireNonNull(provider, "provider is required");
    this.providerSubject = required(providerSubject, "providerSubject");
    this.email = required(email, "email").toLowerCase(Locale.ROOT);
    this.emailVerified = emailVerified;
  }

  public void updateEmail(String value, boolean verified) {
    email = required(value, "email").toLowerCase(Locale.ROOT);
    emailVerified = verified;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " is required");
    }
    return value.trim();
  }
}
