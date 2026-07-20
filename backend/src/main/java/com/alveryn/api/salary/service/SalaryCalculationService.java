package com.alveryn.api.salary.service;

import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.workrecord.calculation.WorkCalculation;
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
  public SalarySnapshot calculateForDate(UUID userId, UUID employmentId, LocalDate workDate, BigDecimal calculatedMinutes) {
    HourlyRatePeriod period = resolveHistoricalRate(userId, employmentId, workDate);
    return new SalarySnapshot(
        period.getHourlyRate(),
        period.getCurrency(),
        WorkCalculation.calculateGross(calculatedMinutes, period.getHourlyRate()));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriod resolveHistoricalRate(UUID userId, UUID employmentId, LocalDate workDate) {
    return hourlyRates
        .findValidForDate(userId, employmentId, workDate)
        .orElseThrow(
            () -> new ValidationException("No hourly rate is configured for " + workDate));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriod resolveCurrentRate(UUID userId, UUID employmentId) {
    return resolveHistoricalRate(userId, employmentId, LocalDate.now(clock));
  }

  public record SalarySnapshot(BigDecimal hourlyRate, String currency, BigDecimal grossAmount) {}
}
