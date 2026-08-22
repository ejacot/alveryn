package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organization_role_assignments")
public class OrganizationRoleAssignment extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "membership_id", nullable = false)
  private OrganizationMembership membership;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "role_id", nullable = false)
  private OrganizationRole role;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "unit_id")
  private OrganizationUnit unit;

  @Column(name = "include_descendants", nullable = false)
  private boolean includeDescendants;

  public OrganizationRoleAssignment(OrganizationMembership membership, OrganizationRole role,
      OrganizationUnit unit, boolean includeDescendants) {
    this.membership = Objects.requireNonNull(membership, "membership is required");
    this.role = Objects.requireNonNull(role, "role is required");
    this.unit = unit;
    this.includeDescendants = includeDescendants;
    var organization = membership.getOrganization();
    if (role.getOrganization() != organization
        || (unit != null && unit.getOrganization() != organization)) {
      throw new IllegalArgumentException("role assignment must stay inside one organization");
    }
  }
}
