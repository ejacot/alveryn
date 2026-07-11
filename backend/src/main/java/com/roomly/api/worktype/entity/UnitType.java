package com.roomly.api.worktype.entity;

import com.roomly.api.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
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
    name = "unit_types",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_unit_types_work_type_name",
            columnNames = {"work_type_id", "normalized_name"}))
public class UnitType extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_type_id", nullable = false)
  private WorkType workType;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "normalized_name", nullable = false, length = 100)
  private String normalizedName;

  @Column(name = "units_per_hour", nullable = false, precision = 10, scale = 4)
  private BigDecimal unitsPerHour;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  public UnitType(WorkType workType, String name, BigDecimal unitsPerHour) {
    this.workType = Objects.requireNonNull(workType, "workType is required");
    if (workType.getCalculationMethod() != CalculationMethod.UNIT_BASED)
      throw new IllegalArgumentException("UnitType requires UNIT_BASED WorkType");
    rename(name);
    changeUnitsPerHour(unitsPerHour);
  }

  public void rename(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("name is required");
    name = value.trim();
    normalizedName = Normalizer.normalize(name, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  }

  public void changeUnitsPerHour(BigDecimal value) {
    if (value == null || value.signum() <= 0)
      throw new IllegalArgumentException("unitsPerHour must be positive");
    unitsPerHour = value;
  }

  public void changeDisplayOrder(int value) {
    if (value < 0) throw new IllegalArgumentException("displayOrder must be non-negative");
    displayOrder = value;
  }

  public void activate() {
    active = true;
  }

  public void deactivate() {
    active = false;
  }
}
