package com.alveryn.api.salary.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.employment.entity.Employment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
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
@Table(name = "hourly_rate_periods")
public class HourlyRatePeriod extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @Column(name = "hourly_rate", nullable = false, precision = 10, scale = 2)
  private BigDecimal hourlyRate;

  @Column(nullable = false, length = 3)
  private String currency;

  @Column(name = "valid_from", nullable = false)
  private LocalDate validFrom;

  @Column(name = "valid_to")
  private LocalDate validTo;

  public HourlyRatePeriod(
      UserAccount user,
      Employment employment,
      BigDecimal hourlyRate,
      String currency,
      LocalDate validFrom,
      LocalDate validTo) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.employment = Objects.requireNonNull(employment, "employment is required");
    if (employment.getUser() != user
        && (employment.getUser().getId() == null
            || !employment.getUser().getId().equals(user.getId()))) {
      throw new IllegalArgumentException("employment must belong to rate user");
    }
    if (hourlyRate == null || hourlyRate.signum() < 0)
      throw new IllegalArgumentException("hourlyRate must be non-negative");
    this.hourlyRate = hourlyRate;
    this.currency = normalizeCurrency(currency);
    if (validFrom == null || validTo != null && validTo.isBefore(validFrom))
      throw new IllegalArgumentException("invalid validity range");
    this.validFrom = validFrom;
    this.validTo = validTo;
  }

  public boolean includes(LocalDate date) {
    Objects.requireNonNull(date, "date is required");
    return !date.isBefore(validFrom) && (validTo == null || !date.isAfter(validTo));
  }

  public void update(BigDecimal rate, String currency, LocalDate from, LocalDate to) {
    if (rate == null || rate.signum() < 0)
      throw new IllegalArgumentException("hourlyRate must be non-negative");
    if (from == null || to != null && to.isBefore(from))
      throw new IllegalArgumentException("invalid validity range");
    hourlyRate = rate;
    this.currency = normalizeCurrency(currency);
    validFrom = from;
    validTo = to;
  }

  private static String normalizeCurrency(String value) {
    if (value == null || !value.trim().matches("[A-Za-z]{3}"))
      throw new IllegalArgumentException("currency must have three letters");
    return value.trim().toUpperCase(Locale.ROOT);
  }
}
