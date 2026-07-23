package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import lombok.*;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organization_invitations")
public class OrganizationInvitation extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;
  @Column(nullable = false, length = 255) private String email;
  @Column(name = "normalized_email", nullable = false, length = 255) private String normalizedEmail;
  @Enumerated(EnumType.STRING)
  @Column(name = "membership_role", nullable = false, length = 20) private MembershipRole role;
  @Column(name = "token_hash", nullable = false, length = 64) private String tokenHash;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "invited_by_membership_id", nullable = false) private OrganizationMembership invitedBy;
  @Column(name = "expires_at", nullable = false) private OffsetDateTime expiresAt;
  @Column(name = "accepted_at") private OffsetDateTime acceptedAt;
  @Column(name = "revoked_at") private OffsetDateTime revokedAt;

  public OrganizationInvitation(Organization organization, String email, MembershipRole role,
      String tokenHash, OrganizationMembership invitedBy, OffsetDateTime expiresAt) {
    this.organization = Objects.requireNonNull(organization);
    this.email = normalize(email);
    this.normalizedEmail = this.email.toLowerCase(Locale.ROOT);
    if (role == MembershipRole.OWNER) throw new IllegalArgumentException("owner cannot be invited");
    this.role = Objects.requireNonNull(role);
    this.tokenHash = Objects.requireNonNull(tokenHash);
    this.invitedBy = Objects.requireNonNull(invitedBy);
    this.expiresAt = Objects.requireNonNull(expiresAt);
  }
  public boolean canAccept(OffsetDateTime now) {
    return acceptedAt == null && revokedAt == null && expiresAt.isAfter(now);
  }
  public void accept(OffsetDateTime now) {
    if (!canAccept(now)) throw new IllegalStateException("invitation is no longer valid");
    acceptedAt = now;
  }
  public void revoke(OffsetDateTime now) {
    if (acceptedAt != null) throw new IllegalStateException("accepted invitation cannot be revoked");
    revokedAt = now;
  }
  private static String normalize(String value) {
    if (value == null || !value.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
      throw new IllegalArgumentException("valid email is required");
    return value.trim();
  }
}
