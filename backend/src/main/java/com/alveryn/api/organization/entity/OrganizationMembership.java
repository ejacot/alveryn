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

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

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
}
