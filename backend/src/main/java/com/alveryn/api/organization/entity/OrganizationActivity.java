package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.text.Normalizer;
import java.util.*;
import lombok.*;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organization_activities")
public class OrganizationActivity extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false) private Organization organization;
  @Column(nullable = false, length = 100) private String name;
  @Column(name = "normalized_name", nullable = false, length = 100) private String normalizedName;
  @Column(nullable = false, length = 7) private String color;
  @Column(name = "default_break_minutes", nullable = false) private int defaultBreakMinutes;
  @Column(nullable = false) private boolean active = true;
  @Column(name = "display_order", nullable = false) private int displayOrder;

  public OrganizationActivity(Organization organization, String name, String color,
      int defaultBreakMinutes, int displayOrder) {
    this.organization = Objects.requireNonNull(organization);
    update(name, color, defaultBreakMinutes, true, displayOrder);
  }
  public void update(String name, String color, int breakMinutes, boolean active, int order) {
    if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
    if (name.trim().length() > 100) throw new IllegalArgumentException("name exceeds 100 characters");
    if (color == null || !color.matches("^#[0-9A-Fa-f]{6}$")) throw new IllegalArgumentException("invalid color");
    if (breakMinutes < 0) throw new IllegalArgumentException("defaultBreakMinutes must be non-negative");
    if (order < 0) throw new IllegalArgumentException("displayOrder must be non-negative");
    this.name = name.trim();
    this.normalizedName = Normalizer.normalize(this.name, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
    this.color = color.toUpperCase(Locale.ROOT);
    this.defaultBreakMinutes = breakMinutes; this.active = active; this.displayOrder = order;
  }
}
