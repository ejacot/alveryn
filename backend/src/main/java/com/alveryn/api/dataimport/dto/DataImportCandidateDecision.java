package com.alveryn.api.dataimport.dto;

import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;
import com.alveryn.api.absence.entity.AbsenceType;
import jakarta.validation.constraints.Min;

public record DataImportCandidateDecision(
    @NotBlank @Size(max = 100) String sourceLabel,
    @NotNull Action action,
    @Size(max = 100) String name,
    UUID workTypeId,
    CalculationMethod calculationMethod,
    CompensationMethod compensationMethod,
    @Positive BigDecimal unitsPerHour,
    @Positive BigDecimal ratePerUnit,
    @Size(min = 3, max = 3) String currency,
    Boolean teamworkEnabled,
    @Positive @Max(1000) BigDecimal extraPayPercentage,
    AbsenceType absenceType,
    Boolean absencePaid,
    @Min(0) @Max(1440) Integer absencePaidMinutesPerDay) {

  public enum Action {
    CREATE_NEW,
    MATCH_EXISTING,
    CONFIGURE_SURCHARGE,
    REVIEW_PER_ENTRY,
    MARK_REST_DAY,
    IMPORT_AS_ABSENCE,
    IGNORE
  }
}
