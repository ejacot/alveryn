package com.alveryn.api.worktype.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
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
@Table(name = "work_types")
public class WorkType extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "employment_id")
  private Employment employment;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_work_type_id")
  private WorkType parent;

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

  @Column(name = "unit_label", length = 100)
  private String unitLabel;

  @Column(name = "unit_symbol", length = 20)
  private String unitSymbol;

  @Column(name = "units_per_hour", precision = 12, scale = 4)
  private BigDecimal unitsPerHour;

  @Column(name = "rate_per_unit", precision = 12, scale = 4)
  private BigDecimal ratePerUnit;

  @Column(length = 3)
  private String currency;

  @Column(name = "teamwork_enabled", nullable = false)
  private boolean teamworkEnabled;

  @Column(name = "extra_pay_enabled", nullable = false)
  private boolean extraPayEnabled;

  @Column(name = "composite_enabled", nullable = false)
  private boolean compositeEnabled;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  public WorkType(UserAccount user, Employment employment, String name, CalculationMethod calculationMethod) {
    this(user, employment, name, calculationMethod, CompensationMethod.HOURLY);
  }

  /** Compatibility constructor for imported and legacy domain data. Application writes assign an Employment. */
  public WorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    this(user, null, name, calculationMethod, CompensationMethod.HOURLY);
  }

  /** Compatibility constructor for imported and legacy domain data. Application writes assign an Employment. */
  public WorkType(UserAccount user, String name, CalculationMethod calculationMethod, CompensationMethod compensationMethod) {
    this(user, null, name, calculationMethod, compensationMethod);
  }

  public WorkType(
      UserAccount user,
      Employment employment, String name,
      CalculationMethod calculationMethod,
      CompensationMethod compensationMethod) {
    this.user = Objects.requireNonNull(user, "user is required");
    if (employment != null) changeEmployment(employment);
    this.calculationMethod =
        Objects.requireNonNull(calculationMethod, "calculationMethod is required");
    changeCompensationMethod(compensationMethod);
    rename(name);
  }

  public void changeEmployment(Employment value) {
    Employment next = Objects.requireNonNull(value, "employment is required");
    if (!next.getUser().getId().equals(user.getId())) throw new IllegalArgumentException("employment must belong to the same user");
    if (parent != null && !next.getId().equals(parent.getEmployment().getId())) throw new IllegalArgumentException("child work type must use its parent's employment");
    employment = next;
  }

  public void changeParent(WorkType value) {
    if (value != null && !value.getUser().getId().equals(user.getId())) {
      throw new IllegalArgumentException("parent work type must belong to the same user");
    }
    if (value != null && getId() != null && getId().equals(value.getId())) {
      throw new IllegalArgumentException("work type cannot be its own parent");
    }
    parent = value;
    if (value != null) employment = value.getEmployment();
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
    if (calculationMethod != CalculationMethod.UNIT_BASED
        && compensationMethod == CompensationMethod.PER_UNIT) {
      compensationMethod = CompensationMethod.HOURLY;
    }
  }

  public void changeCompensationMethod(CompensationMethod value) {
    CompensationMethod next = Objects.requireNonNull(value, "compensationMethod is required");
    if (calculationMethod != CalculationMethod.UNIT_BASED && next == CompensationMethod.PER_UNIT) {
      throw new IllegalArgumentException("Only UNIT_BASED work types can use PER_UNIT compensation");
    }
    compensationMethod = next;
  }

  public void configureUnit(String label, String symbol) {
    String normalizedLabel = label == null ? null : label.trim();
    String normalizedSymbol = symbol == null ? null : symbol.trim();
    unitLabel = normalizedLabel == null || normalizedLabel.isBlank() ? null : normalizedLabel;
    unitSymbol = normalizedSymbol == null || normalizedSymbol.isBlank() ? null : normalizedSymbol;
  }

  public void configureFormula(BigDecimal unitsPerHour, BigDecimal ratePerUnit, String currency) {
    if (unitsPerHour != null && unitsPerHour.signum() <= 0) {
      throw new IllegalArgumentException("unitsPerHour must be positive");
    }
    if (ratePerUnit != null && ratePerUnit.signum() <= 0) {
      throw new IllegalArgumentException("ratePerUnit must be positive");
    }
    this.unitsPerHour = unitsPerHour;
    this.ratePerUnit = ratePerUnit;
    this.currency = normalizeCurrency(currency);
    validateFormula();
  }

  public void changeTeamworkEnabled(boolean value) {
    teamworkEnabled = value;
  }

  public void changeExtraPayEnabled(boolean value) {
    extraPayEnabled = value;
  }

  public void changeCompositeEnabled(boolean value) {
    compositeEnabled = value;
  }

  public WorkLineCalculationMode calculationMode() {
    return switch (calculationMethod) {
      case TIME_BASED -> WorkLineCalculationMode.TIME_HOURLY;
      case UNIT_BASED -> WorkLineCalculationMode.UNITS_PER_UNIT;
      case UNITS_PER_HOUR_BASED -> WorkLineCalculationMode.UNITS_PER_HOUR;
      case FIXED_PRICE_BASED -> WorkLineCalculationMode.FIXED_AMOUNT;
    };
  }

  private void validateFormula() {
    if (compositeEnabled
        && unitLabel == null
        && unitSymbol == null
        && unitsPerHour == null
        && ratePerUnit == null
        && currency == null) {
      compensationMethod =
          calculationMethod == CalculationMethod.UNIT_BASED ? CompensationMethod.PER_UNIT : CompensationMethod.HOURLY;
      return;
    }
    if (calculationMethod == CalculationMethod.TIME_BASED || calculationMethod == CalculationMethod.FIXED_PRICE_BASED) {
      if (unitsPerHour != null || ratePerUnit != null || currency != null || unitLabel != null || unitSymbol != null) {
        throw new IllegalArgumentException(calculationMethod + " work types cannot define unit formula fields");
      }
      compensationMethod = CompensationMethod.HOURLY;
      return;
    }
    if (unitLabel == null || unitLabel.isBlank()) {
      throw new IllegalArgumentException("unitLabel is required");
    }
    if (calculationMethod == CalculationMethod.UNITS_PER_HOUR_BASED) {
      if (unitsPerHour == null || ratePerUnit != null || currency != null) {
        throw new IllegalArgumentException("UNITS_PER_HOUR_BASED requires unitsPerHour only");
      }
      compensationMethod = CompensationMethod.HOURLY;
      return;
    }
    if (ratePerUnit == null || currency == null) {
      throw new IllegalArgumentException("UNIT_BASED requires ratePerUnit and currency");
    }
    compensationMethod = CompensationMethod.PER_UNIT;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String trimmed = value.trim();
    if (!trimmed.matches("[A-Za-z]{3}")) {
      throw new IllegalArgumentException("currency must have three letters");
    }
    return trimmed.toUpperCase(Locale.ROOT);
  }

  public void activate() {
    active = true;
  }

  public void deactivate() {
    active = false;
  }
}
