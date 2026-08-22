package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.util.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organization_roles")
public class OrganizationRole extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @Column(nullable = false, length = 100)
  private String name;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "permissions", nullable = false, columnDefinition = "text[]")
  private List<String> permissions = new ArrayList<>();

  @Column(name = "system_role", nullable = false)
  private boolean systemRole;

  public OrganizationRole(Organization organization, String name,
      Collection<OrganizationPermission> permissions) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    if (name == null || name.isBlank()) throw new IllegalArgumentException("role name is required");
    this.name = name.trim();
    this.permissions = permissions.stream().map(Enum::name).distinct().sorted().toList();
  }

  public void update(String name, Collection<OrganizationPermission> permissions) {
    if (systemRole) throw new IllegalArgumentException("system roles cannot be edited");
    if (name == null || name.isBlank()) throw new IllegalArgumentException("role name is required");
    if (permissions == null || permissions.isEmpty()) {
      throw new IllegalArgumentException("role permissions are required");
    }
    this.name = name.trim();
    this.permissions = permissions.stream().map(Enum::name).distinct().sorted().toList();
  }
}
