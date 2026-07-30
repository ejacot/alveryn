package com.alveryn.api.employment.extrapay;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.math.BigDecimal;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "employment_extra_pay_rules")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmploymentExtraPayRule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private DayOfWeek weekday;

  @Column(nullable = false, precision = 7, scale = 4)
  private BigDecimal percentage;

  @Column(nullable = false)
  private boolean active = true;

  public EmploymentExtraPayRule(
      Employment employment, DayOfWeek weekday, BigDecimal percentage) {
    this.employment = Objects.requireNonNull(employment);
    this.weekday = Objects.requireNonNull(weekday);
    changePercentage(percentage);
  }

  public void changePercentage(BigDecimal value) {
    if (value == null || value.signum() <= 0
        || value.compareTo(BigDecimal.valueOf(1000)) > 0) {
      throw new IllegalArgumentException("percentage must be between 1 and 1000");
    }
    percentage = value.stripTrailingZeros();
    active = true;
  }
}
