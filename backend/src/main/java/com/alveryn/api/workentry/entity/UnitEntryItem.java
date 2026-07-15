package com.alveryn.api.workentry.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.UnitType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Locale;
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

  @Column(name = "unit_symbol_snapshot", length = 20)
  private String unitSymbolSnapshot;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal quantity;

  @Column(name = "units_per_hour_snapshot", precision = 10, scale = 4)
  private BigDecimal unitsPerHourSnapshot;

  @Column(name = "calculated_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal calculatedMinutes;

  @Column(name = "rate_per_unit_snapshot", precision = 12, scale = 4)
  private BigDecimal ratePerUnitSnapshot;

  @Column(name = "currency_snapshot", length = 3)
  private String currencySnapshot;

  @Column(name = "gross_amount_snapshot", precision = 30, scale = 15)
  private BigDecimal grossAmountSnapshot;

  public UnitEntryItem(WorkEntry workEntry, UnitType unitType, BigDecimal quantity) {
    this(
        workEntry,
        unitType,
        quantity,
        unitType.getUnitsPerHour() == null ? BigDecimal.ZERO.setScale(15) : calculateMinutes(quantity, unitType.getUnitsPerHour()),
        null,
        null,
        null);
  }

  public UnitEntryItem(
      WorkEntry workEntry,
      UnitType unitType,
      BigDecimal quantity,
      BigDecimal calculatedMinutes,
      BigDecimal ratePerUnit,
      String currency,
      BigDecimal grossAmount) {
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
    this.unitSymbolSnapshot = unitType.getSymbol();
    this.unitsPerHourSnapshot = unitType.getUnitsPerHour();
    this.quantity = quantity;
    this.calculatedMinutes = normalizeMinutes(calculatedMinutes);
    if (workEntry.getCompensationMethodSnapshot() == CompensationMethod.PER_UNIT) {
      if (ratePerUnit == null || ratePerUnit.signum() <= 0) {
        throw new IllegalArgumentException("ratePerUnit must be positive");
      }
      if (grossAmount == null || grossAmount.signum() < 0) {
        throw new IllegalArgumentException("grossAmount must be non-negative");
      }
      this.ratePerUnitSnapshot = ratePerUnit;
      this.currencySnapshot = normalizeCurrency(currency);
      this.grossAmountSnapshot = grossAmount.setScale(WorkEntry.GROSS_SCALE, RoundingMode.HALF_UP);
    }
  }

  public static BigDecimal calculateMinutes(BigDecimal quantity, BigDecimal unitsPerHour) {
    if (quantity == null
        || quantity.signum() <= 0
        || unitsPerHour == null
        || unitsPerHour.signum() <= 0)
      throw new IllegalArgumentException("values must be positive");
    return quantity
        .multiply(BigDecimal.valueOf(60), MathContext.DECIMAL128)
        .divide(unitsPerHour, MathContext.DECIMAL128)
        .setScale(15, RoundingMode.HALF_UP);
  }

  private static BigDecimal normalizeMinutes(BigDecimal value) {
    if (value == null || value.signum() < 0) {
      throw new IllegalArgumentException("calculatedMinutes must be non-negative");
    }
    return value.setScale(15, RoundingMode.HALF_UP);
  }

  private static String normalizeCurrency(String value) {
    if (value == null || !value.trim().matches("[A-Za-z]{3}")) {
      throw new IllegalArgumentException("currency must have three letters");
    }
    return value.trim().toUpperCase(Locale.ROOT);
  }
}
