package com.alveryn.api.organization.dto;

import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.user.entity.EmploymentType;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class BusinessEmployeeTerms {
  private BusinessEmployeeTerms() {}

  public record Input(
      @NotNull LocalDate validFrom,
      @Size(max = 120) String jobTitle,
      @NotNull EmploymentType employmentType,
      @NotNull LocalDate employmentStart,
      LocalDate employmentEnd,
      UUID primaryUnitId,
      @NotNull @Min(0) @Max(10080) Integer weeklyMinutes,
      @NotNull @Size(max = 7) Set<@NotNull DayOfWeek> workingDays,
      @NotNull CompensationType compensationType,
      @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 4) BigDecimal grossAmount,
      @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency,
      @Size(max = 100) String unitLabel) {}

  public record Term(
      UUID id, LocalDate validFrom, LocalDate validTo, String jobTitle,
      EmploymentType employmentType, LocalDate employmentStart, LocalDate employmentEnd,
      UUID primaryUnitId, String primaryUnitName, int weeklyMinutes, Set<DayOfWeek> workingDays,
      CompensationType compensationType, BigDecimal grossAmount, String currency, String unitLabel,
      OffsetDateTime createdAt) {}

  public record Absence(UUID id, LocalDate from, LocalDate to, String type, String status, String notes) {}

  public record Profile(List<Term> terms, Term currentTerms, BigDecimal contractualMinutes,
      Integer approvedMinutes, LocalDate from, LocalDate to, List<Absence> absences) {}
}
