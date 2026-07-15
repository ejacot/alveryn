package com.alveryn.api.worktype.entity;

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
import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
    name = "work_types",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_work_types_user_name",
            columnNames = {"user_id", "normalized_name"}))
public class WorkType extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "normalized_name", nullable = false, length = 100)
  private String normalizedName;

  @Enumerated(EnumType.STRING)
  @Column(name = "calculation_method", nullable = false, length = 30)
  private CalculationMethod calculationMethod;

  @Enumerated(EnumType.STRING)
  @Column(name = "compensation_method", nullable = false, length = 30)
  private CompensationMethod compensationMethod = CompensationMethod.HOURLY;

  @Column(nullable = false, length = 7)
  private String color = "#87C95A";

  @Column(length = 100)
  private String icon;

  @Column(name = "default_break_minutes")
  private Integer defaultBreakMinutes;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  public WorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    this(user, name, calculationMethod, CompensationMethod.HOURLY);
  }

  public WorkType(
      UserAccount user,
      String name,
      CalculationMethod calculationMethod,
      CompensationMethod compensationMethod) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.calculationMethod =
        Objects.requireNonNull(calculationMethod, "calculationMethod is required");
    changeCompensationMethod(compensationMethod);
    rename(name);
  }

  public void rename(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("name is required");
    name = value.trim();
    normalizedName = Normalizer.normalize(name, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  }

  public void changeColor(String value) {
    if (value == null || !value.matches("#[0-9A-Fa-f]{6}"))
      throw new IllegalArgumentException("invalid color");
    color = value.toUpperCase(Locale.ROOT);
  }

  public void changeDefaultBreakMinutes(Integer value) {
    if (value != null && value < 0)
      throw new IllegalArgumentException("defaultBreakMinutes must be non-negative");
    defaultBreakMinutes = value;
  }

  public void changeDisplayOrder(int value) {
    if (value < 0) throw new IllegalArgumentException("displayOrder must be non-negative");
    displayOrder = value;
  }

  public void changeIcon(String value) {
    icon = value;
  }

  public void changeCalculationMethod(CalculationMethod value) {
    calculationMethod = Objects.requireNonNull(value, "calculationMethod is required");
    if (calculationMethod == CalculationMethod.TIME_BASED
        && compensationMethod == CompensationMethod.PER_UNIT) {
      compensationMethod = CompensationMethod.HOURLY;
    }
  }

  public void changeCompensationMethod(CompensationMethod value) {
    CompensationMethod next = Objects.requireNonNull(value, "compensationMethod is required");
    if (calculationMethod == CalculationMethod.TIME_BASED && next == CompensationMethod.PER_UNIT) {
      throw new IllegalArgumentException("TIME_BASED work types must use HOURLY compensation");
    }
    compensationMethod = next;
  }

  public void activate() {
    active = true;
  }

  public void deactivate() {
    active = false;
  }
}
