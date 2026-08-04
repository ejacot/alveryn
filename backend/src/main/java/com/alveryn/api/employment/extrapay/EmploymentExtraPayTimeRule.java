package com.alveryn.api.employment.extrapay;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "employment_extra_pay_time_rules")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmploymentExtraPayTimeRule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @Column(nullable = false, length = 80)
  private String name;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(nullable = false, precision = 7, scale = 4)
  private BigDecimal percentage;

  public EmploymentExtraPayTimeRule(Employment employment, String name, LocalTime startTime, LocalTime endTime, BigDecimal percentage) {
    this.employment = Objects.requireNonNull(employment);
    change(name, startTime, endTime, percentage);
  }

  public void change(String name, LocalTime startTime, LocalTime endTime, BigDecimal percentage) {
    if (name == null || name.isBlank() || name.trim().length() > 80) {
      throw new IllegalArgumentException("name must contain between 1 and 80 characters");
    }
    if (startTime == null || endTime == null || startTime.equals(endTime)) {
      throw new IllegalArgumentException("Start and end time must be different");
    }
    if (percentage == null || percentage.signum() <= 0 || percentage.compareTo(BigDecimal.valueOf(1000)) > 0) {
      throw new IllegalArgumentException("percentage must be between 0 and 1000");
    }
    this.name = name.trim();
    this.startTime = startTime;
    this.endTime = endTime;
    this.percentage = percentage.stripTrailingZeros();
  }
}
