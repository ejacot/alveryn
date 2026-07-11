package com.roomly.api.workentry.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.WorkType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "work_entries")
public class WorkEntry extends BaseEntity {
  public static final int MONEY_SCALE = 2;
  public static final RoundingMode MONEY_ROUNDING = RoundingMode.HALF_UP;
  public static final MathContext TIME_MATH_CONTEXT = MathContext.DECIMAL128;
  public static final int TIME_SCALE = 15;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_type_id", nullable = false)
  private WorkType workType;

  @Column(name = "work_date", nullable = false)
  private LocalDate workDate;

  @Column(name = "work_type_name_snapshot", nullable = false, length = 100)
  private String workTypeNameSnapshot;

  @Enumerated(EnumType.STRING)
  @Column(name = "calculation_method_snapshot", nullable = false, length = 30)
  private CalculationMethod calculationMethodSnapshot;

  @Column(name = "hourly_rate_snapshot", nullable = false, precision = 10, scale = 2)
  private BigDecimal hourlyRateSnapshot;

  @Column(name = "currency_snapshot", nullable = false, length = 3)
  private String currencySnapshot;

  @Column(name = "calculated_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal calculatedMinutes;

  @Column(name = "gross_amount", nullable = false, precision = 12, scale = 2)
  private BigDecimal grossAmount;

  @Column(length = 500)
  private String notes;

  public WorkEntry(
      UserAccount user,
      WorkType workType,
      LocalDate workDate,
      BigDecimal hourlyRate,
      String currency,
      int calculatedMinutes) {
    this(user, workType, workDate, hourlyRate, currency, BigDecimal.valueOf(calculatedMinutes));
  }

  public WorkEntry(
      UserAccount user,
      WorkType workType,
      LocalDate workDate,
      BigDecimal hourlyRate,
      String currency,
      BigDecimal calculatedMinutes) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.workType = Objects.requireNonNull(workType, "workType is required");
    if (workType.getUser() != user
        && (workType.getUser().getId() == null || !workType.getUser().getId().equals(user.getId())))
      throw new IllegalArgumentException("workType must belong to user");
    this.workDate = Objects.requireNonNull(workDate, "workDate is required");
    if (hourlyRate == null || hourlyRate.signum() < 0)
      throw new IllegalArgumentException("hourlyRate must be non-negative");
    if (calculatedMinutes == null || calculatedMinutes.signum() <= 0)
      throw new IllegalArgumentException("calculatedMinutes must be positive");
    this.workTypeNameSnapshot = workType.getName();
    this.calculationMethodSnapshot = workType.getCalculationMethod();
    this.hourlyRateSnapshot = hourlyRate.setScale(2, MONEY_ROUNDING);
    this.currencySnapshot = normalizeCurrency(currency);
    this.calculatedMinutes = calculatedMinutes.setScale(TIME_SCALE, RoundingMode.UNNECESSARY);
    this.grossAmount = calculateGross(calculatedMinutes, this.hourlyRateSnapshot);
  }

  public static BigDecimal calculateGross(int minutes, BigDecimal hourlyRate) {
    return calculateGross(BigDecimal.valueOf(minutes), hourlyRate);
  }

  public static BigDecimal calculateGross(BigDecimal minutes, BigDecimal hourlyRate) {
    if (minutes == null || minutes.signum() <= 0 || hourlyRate == null || hourlyRate.signum() < 0)
      throw new IllegalArgumentException("invalid calculation inputs");
    return hourlyRate
        .multiply(minutes, TIME_MATH_CONTEXT)
        .divide(BigDecimal.valueOf(60), TIME_MATH_CONTEXT)
        .setScale(MONEY_SCALE, MONEY_ROUNDING);
  }

  public void updateNotes(String value) {
    if (value != null && value.length() > 500)
      throw new IllegalArgumentException("notes exceeds 500 characters");
    notes = value;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || !value.trim().matches("[A-Za-z]{3}"))
      throw new IllegalArgumentException("currency must have three letters");
    return value.trim().toUpperCase(Locale.ROOT);
  }
}
