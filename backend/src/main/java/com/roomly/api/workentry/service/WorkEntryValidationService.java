package com.roomly.api.workentry.service;

import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.workentry.dto.WorkEntryRequest;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.Month;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkEntryValidationService {
  private final AbsenceRepository absences;

  public void validateForPersistence(UUID userId, WorkType workType, @Valid WorkEntryRequest request) {
    ensureNoAbsenceConflict(userId, request.workDate());
    validateWorkType(workType);
  }

  public void validateTimeBasedRequest(WorkEntryRequest request) {
    if (request.startTime() == null || request.endTime() == null) {
      throw new ValidationException("startTime and endTime are required for TIME_BASED entries");
    }
    if (request.unitItems() != null && !request.unitItems().isEmpty()) {
      throw new ValidationException("unitItems are not allowed for TIME_BASED entries");
    }
  }

  public void validateUnitBasedRequest(WorkEntryRequest request) {
    if (request.startTime() != null || request.endTime() != null || request.unpaidBreakMinutes() != null) {
      throw new ValidationException("time fields are not allowed for UNIT_BASED entries");
    }
    if (request.unitItems() == null || request.unitItems().isEmpty()) {
      throw new ValidationException("At least one unit item is required for UNIT_BASED entries");
    }
  }

  public void validateTimeIntervalBreak(int breakMinutes, int totalIntervalMinutes) {
    if (breakMinutes < 0) {
      throw new ValidationException("breakMinutes must be non-negative");
    }
    if (breakMinutes >= totalIntervalMinutes) {
      throw new ValidationException("break must be shorter than interval");
    }
  }

  public void validateUniqueUnitTypes(List<UUID> unitTypeIds) {
    Set<UUID> seen = new HashSet<>();
    for (UUID unitTypeId : unitTypeIds) {
      if (!seen.add(unitTypeId)) {
        throw new ValidationException("Each unit type can appear only once in a work entry");
      }
    }
  }

  public void validateUnitType(UnitType unitType, WorkType workType) {
    if (!unitType.isActive()) {
      throw new ValidationException("Unit type must be active");
    }
    if (!unitType.getWorkType().getId().equals(workType.getId())) {
      throw new ValidationException("Unit type does not belong to the selected work type");
    }
  }

  public DateRange resolveRange(Integer year, Integer month) {
    if (month != null && year == null) {
      throw new ValidationException("year is required when month is provided");
    }
    if (year == null) {
      return new DateRange(null, null);
    }
    if (month == null) {
      return new DateRange(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }
    Month resolvedMonth;
    try {
      resolvedMonth = Month.of(month);
    } catch (RuntimeException ex) {
      throw new ValidationException("month must be between 1 and 12");
    }
    LocalDate from = LocalDate.of(year, resolvedMonth, 1);
    return new DateRange(from, from.withDayOfMonth(from.lengthOfMonth()));
  }

  private void validateWorkType(WorkType workType) {
    if (!workType.isActive()) {
      throw new ValidationException("Work type must be active");
    }
  }

  private void ensureNoAbsenceConflict(UUID userId, LocalDate workDate) {
    if (absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
        userId, workDate, workDate)) {
      throw new ConflictException("A work entry cannot exist on a day with an absence");
    }
  }

  public record DateRange(LocalDate fromDate, LocalDate toDate) {}
}
