package com.alveryn.api.onboarding.dto;

import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.user.entity.FirstDayOfWeek;
import com.alveryn.api.user.entity.ThemePreference;
import com.alveryn.api.user.entity.TimeFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record InitialSetupRequest(
    @NotBlank @Size(max = 80) String firstName,
    @NotBlank @Size(max = 80) String lastName,
    @NotBlank @Size(max = 10) String language,
    @NotBlank @Size(max = 60) String timezone,
    @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency,
    @NotNull FirstDayOfWeek firstDayOfWeek,
    @NotBlank @Size(max = 30) String dateFormat,
    @NotNull TimeFormat timeFormat,
    @NotNull ThemePreference theme,
    @PositiveOrZero int defaultBreakMinutes,
    @Positive int preferredDailyMinutes,
    boolean paidSickLeave,
    boolean paidVacation,
    @NotBlank @Size(max = 120) String employmentName,
    @NotNull LocalDate startDate,
    @NotNull CompensationType compensationType,
    @PositiveOrZero BigDecimal hourlyRate,
    @PositiveOrZero BigDecimal fixedSalaryAmount,
    boolean timerEnabled,
    boolean hourBalanceEnabled,
    @Positive Integer targetMinutes,
    @Positive Integer hourBalanceValidityMonths,
    @NotBlank @Size(max = 100) String workTypeName,
    @Size(max = 100) String unitLabel,
    @Size(max = 20) String unitSymbol,
    @Positive BigDecimal ratePerUnit) {}
