package com.alveryn.api.workentry.service;

import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.workentry.dto.UnitEntryItemRequest;
import com.alveryn.api.workentry.dto.WorkEntryRequest;
import com.alveryn.api.workentry.entity.TimeEntryDetails;
import com.alveryn.api.workentry.entity.UnitEntryItem;
import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.UnitType;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.UnitTypeRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkEntryCalculationService {
  private final UnitTypeRepository unitTypes;
  private final SalaryCalculationService salaryCalculationService;
  private final WorkEntryValidationService validationService;

  public PreparedWorkEntry prepareEntry(UUID userId, WorkType workType, WorkEntryRequest request) {
    return switch (workType.getCalculationMethod()) {
      case TIME_BASED -> prepareTimeBasedEntry(userId, workType, request);
      case UNIT_BASED -> prepareUnitBasedEntry(userId, workType, request);
    };
  }

  public void persistDetails(
      com.alveryn.api.workentry.repository.TimeEntryDetailsRepository timeEntryDetails,
      com.alveryn.api.workentry.repository.UnitEntryItemRepository unitEntryItems,
      WorkEntry entry,
      PreparedWorkEntry prepared) {
    if (entry.getCalculationMethodSnapshot() == CalculationMethod.TIME_BASED) {
      timeEntryDetails.save(
          new TimeEntryDetails(entry, prepared.startTime(), prepared.endTime(), prepared.breakMinutes()));
      return;
    }
    for (PreparedUnitItem item : prepared.unitItems()) {
      unitEntryItems.save(new UnitEntryItem(entry, item.unitType(), item.quantity()));
    }
  }

  private PreparedWorkEntry prepareTimeBasedEntry(
      UUID userId, WorkType workType, WorkEntryRequest request) {
    validationService.validateTimeBasedRequest(request);

    int breakMinutes =
        request.unpaidBreakMinutes() != null
            ? request.unpaidBreakMinutes()
            : workType.getDefaultBreakMinutes() != null ? workType.getDefaultBreakMinutes() : 0;

    try {
      int totalIntervalMinutes = TimeEntryDetails.intervalMinutes(request.startTime(), request.endTime());
      validationService.validateTimeIntervalBreak(breakMinutes, totalIntervalMinutes);
      int workedMinutes = totalIntervalMinutes - breakMinutes;
      SalaryCalculationService.SalarySnapshot salary =
          salaryCalculationService.calculateForDate(
              userId, request.workDate(), BigDecimal.valueOf(workedMinutes));
      return new PreparedWorkEntry(
          BigDecimal.valueOf(workedMinutes),
          salary,
          request.startTime(),
          request.endTime(),
          breakMinutes,
          List.of());
    } catch (IllegalArgumentException ex) {
      throw new ValidationException(ex.getMessage());
    }
  }

  private PreparedWorkEntry prepareUnitBasedEntry(
      UUID userId, WorkType workType, WorkEntryRequest request) {
    validationService.validateUnitBasedRequest(request);
    validationService.validateUniqueUnitTypes(
        request.unitItems().stream().map(UnitEntryItemRequest::unitTypeId).toList());

    List<PreparedUnitItem> preparedItems = new ArrayList<>();
    BigDecimal totalMinutes = BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE);

    for (UnitEntryItemRequest item : request.unitItems()) {
      UnitType unitType = findUnitType(userId, item.unitTypeId());
      validationService.validateUnitType(unitType, workType);
      try {
        BigDecimal calculatedMinutes =
            UnitEntryItem.calculateMinutes(item.quantity(), unitType.getUnitsPerHour());
        preparedItems.add(new PreparedUnitItem(unitType, item.quantity(), calculatedMinutes));
        totalMinutes =
            totalMinutes.add(calculatedMinutes).setScale(WorkEntry.TIME_SCALE, RoundingMode.UNNECESSARY);
      } catch (IllegalArgumentException ex) {
        throw new ValidationException(ex.getMessage());
      }
    }

    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, request.workDate(), totalMinutes);
    return new PreparedWorkEntry(totalMinutes, salary, null, null, null, preparedItems);
  }

  private UnitType findUnitType(UUID userId, UUID unitTypeId) {
    return unitTypes
        .findByIdAndWorkTypeUserId(unitTypeId, userId)
        .orElseThrow(() -> new com.alveryn.api.common.exception.NotFoundException("UnitType", unitTypeId));
  }

  public record PreparedWorkEntry(
      BigDecimal calculatedMinutes,
      SalaryCalculationService.SalarySnapshot salary,
      java.time.LocalTime startTime,
      java.time.LocalTime endTime,
      Integer breakMinutes,
      List<PreparedUnitItem> unitItems) {}

  public record PreparedUnitItem(UnitType unitType, BigDecimal quantity, BigDecimal calculatedMinutes) {}
}
