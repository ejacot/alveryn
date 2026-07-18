package com.alveryn.api.absence.entity;

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
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "absence_types")
public class AbsenceTypeSetting extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(nullable = false, length = 80)
  private String name;

  @Column(name = "normalized_name", nullable = false, length = 80)
  private String normalizedName;

  @Enumerated(EnumType.STRING)
  @Column(length = 30)
  private AbsenceType code;

  @Column(nullable = false)
  private boolean paid;

  @Column(name = "paid_minutes_per_day", nullable = false)
  private int paidMinutesPerDay;

  @Column(nullable = false, length = 7)
  private String color = "#A3A3A3";

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  public AbsenceTypeSetting(
      UserAccount user,
      String name,
      AbsenceType code,
      boolean paid,
      int paidMinutesPerDay,
      String color,
      int displayOrder) {
    this.user = Objects.requireNonNull(user, "user is required");
    update(name, code, paid, paidMinutesPerDay, color, true, displayOrder);
  }

  public void update(
      String name,
      AbsenceType code,
      boolean paid,
      int paidMinutesPerDay,
      String color,
      boolean active,
      int displayOrder) {
    this.name = requireName(name);
    this.normalizedName = normalize(name);
    this.code = code;
    this.paid = paid;
    if (paidMinutesPerDay < 0 || paidMinutesPerDay > 1440) {
      throw new IllegalArgumentException("paidMinutesPerDay must be between 0 and 1440");
    }
    this.paidMinutesPerDay = paid ? paidMinutesPerDay : 0;
    this.color = normalizeColor(color);
    this.active = active;
    if (displayOrder < 0) {
      throw new IllegalArgumentException("displayOrder must be non-negative");
    }
    this.displayOrder = displayOrder;
  }

  private static String requireName(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("name is required");
    }
    String trimmed = value.trim();
    if (trimmed.length() > 80) {
      throw new IllegalArgumentException("name exceeds 80 characters");
    }
    return trimmed;
  }

  public static String normalize(String value) {
    return requireName(value).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
  }

  private static String normalizeColor(String value) {
    String resolved = value == null || value.isBlank() ? "#A3A3A3" : value.trim();
    if (!resolved.matches("^#[0-9A-Fa-f]{6}$")) {
      throw new IllegalArgumentException("color must be a hex color");
    }
    return resolved;
  }
}
