package com.alveryn.api.employment.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.EmploymentType;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.organization.entity.Organization;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "employments")
public class Employment extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "organization_id")
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(nullable = false, length = 120)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "employment_type", length = 30)
  private EmploymentType employmentType;

  @Enumerated(EnumType.STRING)
  @Column(name = "compensation_type", nullable = false, length = 30)
  private CompensationType compensationType;

  @Enumerated(EnumType.STRING)
  @Column(name = "tracking_focus", nullable = false, length = 20)
  private TrackingFocus trackingFocus = TrackingFocus.EARNINGS;

  @Column(name = "hour_balance_enabled", nullable = false)
  private boolean hourBalanceEnabled;

  @Column(name = "timer_enabled", nullable = false)
  private boolean timerEnabled;

  @Column(name = "start_date") private LocalDate startDate;
  @Column(name = "end_date") private LocalDate endDate;
  @Column(name = "fixed_salary_amount", precision = 14, scale = 4) private BigDecimal fixedSalaryAmount;
  @Column(length = 3) private String currency;
  @Column(name = "target_minutes") private Integer targetMinutes;
  @Column(name = "hour_balance_validity_months") private Integer hourBalanceValidityMonths;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_period", length = 20)
  private TargetPeriod targetPeriod;

  @Column(nullable = false) private boolean active = true;
  @Column(name = "display_order", nullable = false) private int displayOrder;

  public Employment(Organization organization, UserAccount user, String name) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    this.user = Objects.requireNonNull(user, "user is required");
    rename(name);
  }

  /**
   * Compatibility constructor for legacy imports and fixtures. Application services must use the
   * workspace-aware constructor.
   */
  public Employment(UserAccount user, String name) {
    this.user = Objects.requireNonNull(user, "user is required");
    rename(name);
  }

  public void configure(EmploymentType employmentType, CompensationType compensationType,
      LocalDate startDate, LocalDate endDate, BigDecimal fixedSalaryAmount, String currency,
      Integer targetMinutes, TargetPeriod targetPeriod, Integer hourBalanceValidityMonths,
      boolean active, int displayOrder) {
    if (endDate != null && startDate != null && endDate.isBefore(startDate)) throw new IllegalArgumentException("endDate must be on or after startDate");
    if (fixedSalaryAmount != null && fixedSalaryAmount.signum() < 0) throw new IllegalArgumentException("fixedSalaryAmount must be non-negative");
    if (targetMinutes != null && targetMinutes <= 0) throw new IllegalArgumentException("targetMinutes must be positive");
    if (hourBalanceValidityMonths != null && hourBalanceValidityMonths <= 0) throw new IllegalArgumentException("hourBalanceValidityMonths must be positive");
    if (compensationType == CompensationType.FIXED_SALARY && (targetMinutes == null || targetPeriod == null)) throw new IllegalArgumentException("fixed salary requires targetMinutes and targetPeriod");
    this.employmentType = employmentType;
    this.compensationType = Objects.requireNonNull(compensationType, "compensationType is required");
    this.trackingFocus = compensationType == CompensationType.FIXED_SALARY ? TrackingFocus.TIME : TrackingFocus.EARNINGS;
    this.hourBalanceEnabled = compensationType == CompensationType.FIXED_SALARY;
    this.startDate = startDate;
    this.endDate = endDate;
    this.fixedSalaryAmount = fixedSalaryAmount;
    this.currency = normalizeCurrency(currency);
    this.targetMinutes = targetMinutes;
    this.targetPeriod = targetPeriod;
    this.hourBalanceValidityMonths = compensationType == CompensationType.FIXED_SALARY
        ? Objects.requireNonNullElse(hourBalanceValidityMonths, 12) : null;
    this.active = active;
    this.displayOrder = displayOrder;
  }

  public void configure(EmploymentType employmentType, CompensationType compensationType,
      LocalDate startDate, LocalDate endDate, BigDecimal fixedSalaryAmount, String currency,
      Integer targetMinutes, TargetPeriod targetPeriod, boolean active, int displayOrder) {
    configure(employmentType, compensationType, startDate, endDate, fixedSalaryAmount, currency,
        targetMinutes, targetPeriod, null, active, displayOrder);
  }

  public void rename(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("name is required");
    name = value.trim();
  }

  public void configureTracking(TrackingFocus focus, boolean balanceEnabled) {
    trackingFocus = Objects.requireNonNull(focus, "trackingFocus is required");
    hourBalanceEnabled = balanceEnabled;
  }

  public void configureTimer(boolean enabled) {
    timerEnabled = enabled;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || value.isBlank()) return null;
    String normalized = value.trim().toUpperCase(Locale.ROOT);
    if (!normalized.matches("[A-Z]{3}")) throw new IllegalArgumentException("currency must have three letters");
    return normalized;
  }
}
