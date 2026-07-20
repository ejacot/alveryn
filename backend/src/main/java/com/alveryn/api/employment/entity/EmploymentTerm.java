package com.alveryn.api.employment.entity;

import com.alveryn.api.common.persistence.BaseEntity;
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
@Table(name = "employment_terms")
public class EmploymentTerm extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;
  @Column(name = "valid_from", nullable = false) private LocalDate validFrom;
  @Column(name = "valid_to") private LocalDate validTo;
  @Enumerated(EnumType.STRING) @Column(name = "compensation_type", nullable = false, length = 30)
  private CompensationType compensationType;
  @Column(name = "fixed_salary_amount", precision = 14, scale = 4) private BigDecimal fixedSalaryAmount;
  @Column(length = 3) private String currency;
  @Column(name = "target_minutes") private Integer targetMinutes;
  @Enumerated(EnumType.STRING) @Column(name = "target_period", length = 20) private TargetPeriod targetPeriod;

  public EmploymentTerm(Employment employment, LocalDate validFrom, CompensationType compensationType,
      BigDecimal fixedSalaryAmount, String currency, Integer targetMinutes, TargetPeriod targetPeriod) {
    this.employment = Objects.requireNonNull(employment, "employment is required");
    this.validFrom = Objects.requireNonNull(validFrom, "validFrom is required");
    configure(compensationType, fixedSalaryAmount, currency, targetMinutes, targetPeriod);
  }

  public void configure(CompensationType compensationType, BigDecimal fixedSalaryAmount,
      String currency, Integer targetMinutes, TargetPeriod targetPeriod) {
    if (fixedSalaryAmount != null && fixedSalaryAmount.signum() < 0) throw new IllegalArgumentException("fixedSalaryAmount must be non-negative");
    if (targetMinutes != null && targetMinutes <= 0) throw new IllegalArgumentException("targetMinutes must be positive");
    if (compensationType == CompensationType.FIXED_SALARY && (targetMinutes == null || targetPeriod == null)) throw new IllegalArgumentException("fixed salary requires targetMinutes and targetPeriod");
    this.compensationType = Objects.requireNonNull(compensationType, "compensationType is required");
    this.fixedSalaryAmount = fixedSalaryAmount;
    this.currency = normalizeCurrency(currency);
    this.targetMinutes = targetMinutes;
    this.targetPeriod = targetPeriod;
  }

  public void endBefore(LocalDate nextStart) {
    if (!nextStart.isAfter(validFrom)) throw new IllegalArgumentException("next term must start after current term");
    validTo = nextStart.minusDays(1);
  }

  public boolean sameTerms(CompensationType type, BigDecimal salary, String nextCurrency,
      Integer target, TargetPeriod period) {
    return compensationType == type && Objects.equals(fixedSalaryAmount, salary)
        && Objects.equals(currency, normalizeCurrency(nextCurrency))
        && Objects.equals(targetMinutes, target) && targetPeriod == period;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || value.isBlank()) return null;
    String normalized = value.trim().toUpperCase(Locale.ROOT);
    if (!normalized.matches("[A-Z]{3}")) throw new IllegalArgumentException("currency must have three letters");
    return normalized;
  }
}
