package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organization_memberships")
public class OrganizationMembership extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id")
  private UserAccount user;

  @Column(name = "first_name", length = 100)
  private String firstName;

  @Column(name = "last_name", length = 100)
  private String lastName;

  @Column(name = "invited_email", length = 320)
  private String invitedEmail;

  @Column(name = "ended_at")
  private OffsetDateTime endedAt;

  @Column(name = "invitation_token_hash", length = 64)
  private String invitationTokenHash;

  @Column(name = "invitation_expires_at")
  private OffsetDateTime invitationExpiresAt;

  @Enumerated(EnumType.STRING)
  @Column(name = "membership_role", nullable = false, length = 20)
  private MembershipRole role;

  @Enumerated(EnumType.STRING)
  @Column(name = "membership_status", nullable = false, length = 20)
  private MembershipStatus status;

  @Column(name = "joined_at")
  private OffsetDateTime joinedAt;

  public OrganizationMembership(Organization organization, UserAccount user, MembershipRole role) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    this.user = Objects.requireNonNull(user, "user is required");
    this.role = Objects.requireNonNull(role, "role is required");
    this.status = MembershipStatus.ACTIVE;
    this.joinedAt = OffsetDateTime.now();
  }

  public OrganizationMembership(Organization organization, String firstName, String lastName,
      String invitedEmail) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    this.firstName = clean(firstName);
    this.lastName = clean(lastName);
    if (this.firstName == null && this.lastName == null) {
      throw new IllegalArgumentException("first name or last name is required");
    }
    this.invitedEmail = clean(invitedEmail);
    this.role = MembershipRole.EMPLOYEE;
    this.status = MembershipStatus.INVITED;
  }

  public void claim(UserAccount user) {
    if (this.user != null && !this.user.getId().equals(user.getId())) {
      throw new IllegalStateException("membership already belongs to another user");
    }
    this.user = Objects.requireNonNull(user, "user is required");
    this.invitedEmail = null;
    this.status = MembershipStatus.ACTIVE;
    this.joinedAt = OffsetDateTime.now();
    this.endedAt = null;
    clearInvitation();
  }

  public void issueInvitation(String tokenHash, OffsetDateTime expiresAt) {
    if (status != MembershipStatus.INVITED || invitedEmail == null) {
      throw new IllegalStateException("only pending email invitations can be issued");
    }
    this.invitationTokenHash = Objects.requireNonNull(tokenHash);
    this.invitationExpiresAt = Objects.requireNonNull(expiresAt);
  }

  public boolean invitationIsValid(OffsetDateTime now) {
    return status == MembershipStatus.INVITED && invitationTokenHash != null
        && invitationExpiresAt != null && invitationExpiresAt.isAfter(now);
  }

  public void declineInvitation() { suspend(); }

  private void clearInvitation() {
    this.invitationTokenHash = null;
    this.invitationExpiresAt = null;
  }

  public void suspend() {
    if (role == MembershipRole.OWNER) throw new IllegalArgumentException("organization owner cannot be suspended");
    if (status == MembershipStatus.SUSPENDED) return;
    this.status = MembershipStatus.SUSPENDED;
    this.endedAt = OffsetDateTime.now();
    clearInvitation();
  }

  public void reactivate() {
    if (status != MembershipStatus.SUSPENDED) return;
    this.status = user == null ? MembershipStatus.INVITED : MembershipStatus.ACTIVE;
    this.endedAt = null;
  }

  private static String clean(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
