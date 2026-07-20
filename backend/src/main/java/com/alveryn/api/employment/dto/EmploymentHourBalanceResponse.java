package com.alveryn.api.employment.dto;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

public record EmploymentHourBalanceResponse(UUID employmentId, YearMonth month,
    long workedMinutes, long targetMinutes, long monthBalanceMinutes, long carriedBalanceMinutes,
    LocalDate balancePeriodStart, int validityMonths) {}
