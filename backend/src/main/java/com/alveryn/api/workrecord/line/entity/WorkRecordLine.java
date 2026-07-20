package com.alveryn.api.workrecord.line.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.time.TimeCalculator;
import com.alveryn.api.workrecord.calculation.WorkCalculation;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.worktype.entity.WorkType;
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
import java.time.LocalTime;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "work_record_lines")
public class WorkRecordLine extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_session_id", nullable = false)
  private WorkRecord workRecord;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_type_id", nullable = false)
  private WorkType workType;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  @Column(name = "work_type_name_snapshot", nullable = false, length = 100)
  private String workTypeNameSnapshot;

  @Column(name = "configuration_name_snapshot", nullable = false, length = 120)
  private String configurationNameSnapshot;

  @Enumerated(EnumType.STRING)
  @Column(name = "calculation_mode_snapshot", nullable = false, length = 40)
  private WorkLineCalculationMode calculationModeSnapshot;

  @Column(name = "unit_label_snapshot", length = 100)
  private String unitLabelSnapshot;

  @Column(name = "unit_symbol_snapshot", length = 20)
  private String unitSymbolSnapshot;

  @Column(precision = 18, scale = 4)
  private BigDecimal quantity;

  @Column(name = "fixed_amount_snapshot", precision = 30, scale = 15)
  private BigDecimal fixedAmountSnapshot;

  @Column(name = "units_per_hour_snapshot", precision = 12, scale = 4)
  private BigDecimal unitsPerHourSnapshot;

  @Column(name = "start_time")
  private LocalTime startTime;

  @Column(name = "end_time")
  private LocalTime endTime;

  @Column(name = "break_minutes")
  private Integer breakMinutes;

  @Column(name = "duration_minutes")
  private Integer durationMinutes;

  @Column(name = "calculated_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal calculatedMinutes;

  @Column(name = "hourly_rate_snapshot", precision = 10, scale = 2)
  private BigDecimal hourlyRateSnapshot;

  @Column(name = "rate_per_unit_snapshot", precision = 12, scale = 4)
  private BigDecimal ratePerUnitSnapshot;

  @Column(name = "currency_snapshot", length = 3)
  private String currencySnapshot;

  @Column(name = "gross_amount", nullable = false, precision = 30, scale = 15)
  private BigDecimal grossAmount;

  @Column(name = "worked_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal workedMinutes;

  @Column(name = "extra_paid_equivalent_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal extraPaidEquivalentMinutes;

  @Column(name = "total_paid_equivalent_minutes", nullable = false, precision = 30, scale = 15)
  private BigDecimal totalPaidEquivalentMinutes;

  @Column(name = "base_gross_amount", nullable = false, precision = 30, scale = 15)
  private BigDecimal baseGrossAmount;

  @Column(name = "extra_gross_amount", nullable = false, precision = 30, scale = 15)
  private BigDecimal extraGrossAmount;

  @Column(name = "total_gross_amount", nullable = false, precision = 30, scale = 15)
  private BigDecimal totalGrossAmount;

  @Column(name = "extra_pay_percentage", nullable = false)
  private int extraPayPercentage;

  @Column(length = 500)
  private String notes;

  public static WorkRecordLine timeHourly(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      LocalTime startTime,
      LocalTime endTime,
      int breakMinutes,
      BigDecimal hourlyRate,
      String currency,
      int extraPayPercentage,
      String notes) {
    int totalIntervalMinutes = TimeCalculator.intervalMinutes(startTime, endTime);
    if (breakMinutes < 0 || breakMinutes >= totalIntervalMinutes) {
      throw new IllegalArgumentException("break must be shorter than interval");
    }
    BigDecimal minutes = BigDecimal.valueOf(totalIntervalMinutes - breakMinutes);
    BigDecimal baseGross = WorkCalculation.calculateGross(minutes, hourlyRate, 0);
    WorkRecordLine line = base(record, workType, displayOrder, extraPayPercentage, notes);
    line.startTime = startTime;
    line.endTime = endTime;
    line.breakMinutes = breakMinutes;
    line.calculatedMinutes = minutes.setScale(WorkCalculation.TIME_SCALE, RoundingMode.UNNECESSARY);
    line.hourlyRateSnapshot = hourlyRate.setScale(WorkCalculation.RATE_SCALE, WorkCalculation.RATE_ROUNDING);
    line.currencySnapshot = normalizeCurrency(currency);
    line.captureResults(minutes, baseGross, extraPayPercentage);
    return line;
  }

  public static WorkRecordLine timeHourlyDuration(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      int durationMinutes,
      BigDecimal hourlyRate,
      String currency,
      int extraPayPercentage,
      String notes) {
    if (durationMinutes <= 0) {
      throw new IllegalArgumentException("durationMinutes must be positive");
    }
    BigDecimal minutes = BigDecimal.valueOf(durationMinutes);
    BigDecimal baseGross = WorkCalculation.calculateGross(minutes, hourlyRate, 0);
    WorkRecordLine line = base(record, workType, displayOrder, extraPayPercentage, notes);
    line.durationMinutes = durationMinutes;
    line.calculatedMinutes = minutes.setScale(WorkCalculation.TIME_SCALE, RoundingMode.UNNECESSARY);
    line.hourlyRateSnapshot = hourlyRate.setScale(WorkCalculation.RATE_SCALE, WorkCalculation.RATE_ROUNDING);
    line.currencySnapshot = normalizeCurrency(currency);
    line.captureResults(minutes, baseGross, extraPayPercentage);
    return line;
  }

  public static WorkRecordLine timeOnly(WorkRecord record, WorkType workType, int displayOrder,
      LocalTime startTime, LocalTime endTime, int breakMinutes, String notes) {
    int totalIntervalMinutes = TimeCalculator.intervalMinutes(startTime, endTime);
    if (breakMinutes < 0 || breakMinutes >= totalIntervalMinutes) throw new IllegalArgumentException("break must be shorter than interval");
    WorkRecordLine line = base(record, workType, displayOrder, 0, notes);
    line.calculationModeSnapshot = WorkLineCalculationMode.TIME_ONLY;
    line.startTime = startTime; line.endTime = endTime; line.breakMinutes = breakMinutes;
    line.calculatedMinutes = BigDecimal.valueOf(totalIntervalMinutes - breakMinutes).setScale(WorkCalculation.TIME_SCALE);
    line.captureResults(line.calculatedMinutes, BigDecimal.ZERO, 0);
    return line;
  }

  public static WorkRecordLine timeOnlyDuration(WorkRecord record, WorkType workType, int displayOrder,
      int durationMinutes, String notes) {
    if (durationMinutes <= 0) throw new IllegalArgumentException("durationMinutes must be positive");
    WorkRecordLine line = base(record, workType, displayOrder, 0, notes);
    line.calculationModeSnapshot = WorkLineCalculationMode.TIME_ONLY;
    line.durationMinutes = durationMinutes;
    line.calculatedMinutes = BigDecimal.valueOf(durationMinutes).setScale(WorkCalculation.TIME_SCALE);
    line.captureResults(line.calculatedMinutes, BigDecimal.ZERO, 0);
    return line;
  }

  public static WorkRecordLine unitsPerHour(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      BigDecimal quantity,
      BigDecimal hourlyRate,
      String currency,
      int extraPayPercentage,
      String notes) {
    BigDecimal minutes =
        quantity
            .multiply(BigDecimal.valueOf(60), MathContext.DECIMAL128)
            .divide(workType.getUnitsPerHour(), MathContext.DECIMAL128)
            .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    BigDecimal baseGross = WorkCalculation.calculateGross(minutes, hourlyRate, 0);
    WorkRecordLine line = unitBase(record, workType, displayOrder, quantity, extraPayPercentage, notes);
    line.unitsPerHourSnapshot = workType.getUnitsPerHour();
    line.calculatedMinutes = minutes;
    line.hourlyRateSnapshot = hourlyRate.setScale(WorkCalculation.RATE_SCALE, WorkCalculation.RATE_ROUNDING);
    line.currencySnapshot = normalizeCurrency(currency);
    line.captureResults(minutes, baseGross, extraPayPercentage);
    return line;
  }

  public static WorkRecordLine unitsPerUnit(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      BigDecimal quantity,
      Integer teamSize,
      int extraPayPercentage,
      String notes) {
    BigDecimal minutes =
        workType.getUnitsPerHour() == null
            ? BigDecimal.ZERO.setScale(WorkCalculation.TIME_SCALE)
            : quantity
                .multiply(BigDecimal.valueOf(60), MathContext.DECIMAL128)
                .divide(workType.getUnitsPerHour(), MathContext.DECIMAL128)
                .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    WorkRecordLine line = unitBase(record, workType, displayOrder, quantity, extraPayPercentage, notes);
    line.unitsPerHourSnapshot = workType.getUnitsPerHour();
    line.calculatedMinutes = minutes;
    line.ratePerUnitSnapshot = workType.getRatePerUnit();
    line.currencySnapshot = normalizeCurrency(workType.getCurrency());
    BigDecimal baseGross = WorkCalculation.calculatePerUnitGross(quantity, workType.getRatePerUnit());
    if (workType.isTeamworkEnabled()) {
      if (teamSize == null || teamSize <= 0) {
        throw new IllegalArgumentException("teamSize is required for teamwork work types");
      }
      baseGross = baseGross.divide(BigDecimal.valueOf(teamSize), WorkCalculation.GROSS_SCALE, RoundingMode.HALF_UP);
    }
    line.captureResults(BigDecimal.ZERO, baseGross, extraPayPercentage);
    return line;
  }

  public static WorkRecordLine unitsPerUnit(
      WorkRecord record, WorkType workType, int displayOrder, BigDecimal quantity,
      Integer teamSize, String notes) {
    return unitsPerUnit(record, workType, displayOrder, quantity, teamSize, 0, notes);
  }

  public static WorkRecordLine fixedAmount(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      BigDecimal fixedAmount,
      String currency,
      int extraPayPercentage,
      String notes) {
    if (fixedAmount == null || fixedAmount.signum() <= 0) {
      throw new IllegalArgumentException("fixedAmount must be positive");
    }
    WorkRecordLine line = base(record, workType, displayOrder, extraPayPercentage, notes);
    line.fixedAmountSnapshot = fixedAmount.setScale(WorkCalculation.GROSS_SCALE, RoundingMode.HALF_UP);
    line.calculatedMinutes = BigDecimal.ZERO.setScale(WorkCalculation.TIME_SCALE);
    line.currencySnapshot = normalizeCurrency(currency);
    line.captureResults(BigDecimal.ZERO, line.fixedAmountSnapshot, extraPayPercentage);
    return line;
  }

  public static WorkRecordLine fixedAmount(
      WorkRecord record, WorkType workType, int displayOrder, BigDecimal fixedAmount,
      String currency, String notes) {
    return fixedAmount(record, workType, displayOrder, fixedAmount, currency, 0, notes);
  }

  private static WorkRecordLine base(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      int extraPayPercentage,
      String notes) {
    if (!workType.isActive()) {
      throw new IllegalArgumentException("work type is inactive");
    }
    WorkRecordLine line = new WorkRecordLine();
    line.workRecord = Objects.requireNonNull(record, "record is required");
    line.workType = Objects.requireNonNull(workType, "workType is required");
    boolean sameUser =
        line.workType.getUser() == record.getUser()
            || (line.workType.getUser().getId() != null
                && Objects.equals(line.workType.getUser().getId(), record.getUser().getId()));
    if (!sameUser) {
      throw new IllegalArgumentException("work type must belong to record user");
    }
    if (displayOrder < 0) {
      throw new IllegalArgumentException("displayOrder must be non-negative");
    }
    if (extraPayPercentage < 0 || extraPayPercentage > 1000) {
      throw new IllegalArgumentException("extraPayPercentage must be between 0 and 1000");
    }
    line.displayOrder = displayOrder;
    line.workTypeNameSnapshot = line.workType.getName();
    line.configurationNameSnapshot = workType.getName();
    line.calculationModeSnapshot = workType.calculationMode();
    line.unitLabelSnapshot = workType.getUnitLabel();
    line.unitSymbolSnapshot = workType.getUnitSymbol();
    line.extraPayPercentage = extraPayPercentage;
    line.updateNotes(notes);
    return line;
  }

  private static WorkRecordLine unitBase(
      WorkRecord record,
      WorkType workType,
      int displayOrder,
      BigDecimal quantity,
      int extraPayPercentage,
      String notes) {
    if (quantity == null || quantity.signum() <= 0) {
      throw new IllegalArgumentException("quantity must be positive");
    }
    WorkRecordLine line = base(record, workType, displayOrder, extraPayPercentage, notes);
    line.quantity = quantity;
    return line;
  }

  private void updateNotes(String value) {
    if (value != null && value.length() > 500) {
      throw new IllegalArgumentException("notes exceeds 500 characters");
    }
    notes = value;
  }

  private void captureResults(
      BigDecimal workedMinutes, BigDecimal baseGrossAmount, int extraPayPercentage) {
    this.workedMinutes = workedMinutes.setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    this.extraPaidEquivalentMinutes = this.workedMinutes
        .multiply(BigDecimal.valueOf(extraPayPercentage), WorkCalculation.TIME_MATH_CONTEXT)
        .divide(BigDecimal.valueOf(100), WorkCalculation.TIME_MATH_CONTEXT)
        .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    this.totalPaidEquivalentMinutes = this.workedMinutes
        .add(this.extraPaidEquivalentMinutes)
        .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    this.baseGrossAmount = baseGrossAmount.setScale(WorkCalculation.GROSS_SCALE, RoundingMode.HALF_UP);
    this.totalGrossAmount = WorkCalculation.applyExtraPay(this.baseGrossAmount, extraPayPercentage);
    this.extraGrossAmount = this.totalGrossAmount
        .subtract(this.baseGrossAmount)
        .setScale(WorkCalculation.GROSS_SCALE, RoundingMode.HALF_UP);
    this.grossAmount = this.totalGrossAmount;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || !value.trim().matches("[A-Za-z]{3}")) {
      throw new IllegalArgumentException("currency must have three letters");
    }
    return value.trim().toUpperCase(Locale.ROOT);
  }
}
