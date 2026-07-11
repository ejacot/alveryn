package com.roomly.api.workentry.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
    name = "unit_entry_items",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_unit_entry_items_entry_type",
            columnNames = {"work_entry_id", "unit_type_id"}))
public class UnitEntryItem extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_entry_id", nullable = false)
  private WorkEntry workEntry;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "unit_type_id", nullable = false)
  private UnitType unitType;

  @Column(name = "unit_name_snapshot", nullable = false, length = 100)
  private String unitNameSnapshot;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal quantity;

  @Column(name = "units_per_hour_snapshot", nullable = false, precision = 10, scale = 4)
  private BigDecimal unitsPerHourSnapshot;

  @Column(name = "calculated_minutes", nullable = false)
  private int calculatedMinutes;

  public UnitEntryItem(WorkEntry workEntry, UnitType unitType, BigDecimal quantity) {
    this.workEntry = Objects.requireNonNull(workEntry, "workEntry is required");
    this.unitType = Objects.requireNonNull(unitType, "unitType is required");
    if (workEntry.getCalculationMethodSnapshot() != CalculationMethod.UNIT_BASED)
      throw new IllegalArgumentException("requires UNIT_BASED entry");
    if (unitType.getWorkType() != workEntry.getWorkType()
        && (unitType.getWorkType().getId() == null
            || !unitType.getWorkType().getId().equals(workEntry.getWorkType().getId())))
      throw new IllegalArgumentException("unitType must belong to entry workType");
    if (quantity == null || quantity.signum() <= 0)
      throw new IllegalArgumentException("quantity must be positive");
    this.unitNameSnapshot = unitType.getName();
    this.unitsPerHourSnapshot = unitType.getUnitsPerHour();
    this.quantity = quantity;
    this.calculatedMinutes = calculateMinutes(quantity, unitsPerHourSnapshot);
  }

  public static int calculateMinutes(BigDecimal quantity, BigDecimal unitsPerHour) {
    if (quantity == null
        || quantity.signum() <= 0
        || unitsPerHour == null
        || unitsPerHour.signum() <= 0)
      throw new IllegalArgumentException("values must be positive");
    return quantity
        .multiply(BigDecimal.valueOf(60))
        .divide(unitsPerHour, 0, RoundingMode.HALF_UP)
        .intValueExact();
  }
}
