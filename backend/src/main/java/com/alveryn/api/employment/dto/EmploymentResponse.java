package com.alveryn.api.employment.dto;

import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.TrackingFocus;
import com.alveryn.api.employment.entity.TargetPeriod;
import com.alveryn.api.user.entity.EmploymentType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record EmploymentResponse(UUID id, String name, EmploymentType employmentType,
    CompensationType compensationType, TrackingFocus trackingFocus, boolean hourBalanceEnabled,
    boolean timerEnabled,
    LocalDate termsValidFrom, LocalDate startDate, LocalDate endDate,
    BigDecimal fixedSalaryAmount, String currency, Integer targetMinutes,
    TargetPeriod targetPeriod, Integer hourBalanceValidityMonths,
    boolean active, int displayOrder, boolean deletable) {}
