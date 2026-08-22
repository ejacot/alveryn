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
@Table(name = "organization_units")
public class OrganizationUnit extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_id")
  private OrganizationUnit parent;

  @Column(nullable = false, length = 160)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "unit_type", nullable = false, length = 40)
  private OrganizationUnitType type;

  @Enumerated(EnumType.STRING)
  @Column(name = "check_in_mode", nullable = false, length = 20)
  private CheckInMode checkInMode;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  public OrganizationUnit(Organization organization, OrganizationUnit parent, String name,
      OrganizationUnitType type, CheckInMode checkInMode, int displayOrder) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    this.parent = parent;
    this.name = required(name);
    this.type = Objects.requireNonNull(type, "type is required");
    this.checkInMode = Objects.requireNonNull(checkInMode, "check-in mode is required");
    this.displayOrder = displayOrder;
    if (parent != null && parent.getOrganization() != organization) {
      throw new IllegalArgumentException("parent must belong to the same organization");
    }
  }

  public void changeDetails(OrganizationUnit parent, String name, OrganizationUnitType type,
      CheckInMode checkInMode, int displayOrder) {
    if (parent == this) throw new IllegalArgumentException("unit cannot be its own parent");
    if (parent != null && parent.getOrganization() != organization) {
      throw new IllegalArgumentException("parent must belong to the same organization");
    }
    this.parent = parent;
    this.name = required(name);
    this.type = Objects.requireNonNull(type, "type is required");
    this.checkInMode = Objects.requireNonNull(checkInMode, "check-in mode is required");
    this.displayOrder = displayOrder;
  }

  public void deactivate() { active = false; }
  public void reactivate() { active = true; }

  private static String required(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("name is required");
    return value.trim();
  }
}
