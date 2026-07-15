package com.alveryn.api.salary.service;

import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.workentry.entity.WorkEntry;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SalaryCalculationService {
  private final HourlyRatePeriodRepository hourlyRates;
  private final Clock clock;

  @Transactional(readOnly = true)
  public SalarySnapshot calculateForDate(UUID userId, LocalDate workDate, BigDecimal calculatedMinutes) {
    HourlyRatePeriod period = resolveHistoricalRate(userId, workDate);
    return new SalarySnapshot(
        period.getHourlyRate(),
        period.getCurrency(),
        WorkEntry.calculateGross(calculatedMinutes, period.getHourlyRate()));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriod resolveHistoricalRate(UUID userId, LocalDate workDate) {
    return hourlyRates
        .findValidForDate(userId, workDate)
        .orElseThrow(
            () -> new ValidationException("No hourly rate is configured for " + workDate));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriod resolveCurrentRate(UUID userId) {
    return resolveHistoricalRate(userId, LocalDate.now(clock));
  }

  public record SalarySnapshot(BigDecimal hourlyRate, String currency, BigDecimal grossAmount) {}
}
