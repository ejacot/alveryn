package com.alveryn.api.employment.dto;

import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.TrackingFocus;
import com.alveryn.api.employment.entity.TargetPeriod;
import com.alveryn.api.user.entity.EmploymentType;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EmploymentRequest(
    @NotBlank @Size(max = 120) String name,
    EmploymentType employmentType,
    CompensationType compensationType,
    TrackingFocus trackingFocus,
    Boolean hourBalanceEnabled,
    LocalDate termsValidFrom,
    LocalDate startDate,
    LocalDate endDate,
    @PositiveOrZero BigDecimal fixedSalaryAmount,
    @Size(min = 3, max = 3) String currency,
    @Positive Integer targetMinutes,
    TargetPeriod targetPeriod,
    @Positive Integer hourBalanceValidityMonths,
    Boolean active,
    @PositiveOrZero Integer displayOrder) {}
