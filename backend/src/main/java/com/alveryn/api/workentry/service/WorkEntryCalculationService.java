package com.alveryn.api.workentry.service;

import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.workentry.dto.UnitEntryItemRequest;
import com.alveryn.api.workentry.dto.WorkEntryRequest;
import com.alveryn.api.workentry.entity.TimeEntryDetails;
import com.alveryn.api.workentry.entity.UnitEntryItem;
import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
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
      unitEntryItems.save(
          new UnitEntryItem(
              entry,
              item.unitType(),
              item.quantity(),
              item.calculatedMinutes(),
              item.ratePerUnit(),
              item.currency(),
              item.grossAmount()));
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
          normalizeExtraPayPercentage(request.extraPayPercentage()),
          CompensationMethod.HOURLY,
          null,
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

    if (workType.getCompensationMethod() == CompensationMethod.PER_UNIT) {
      return preparePerUnitEntry(userId, workType, request);
    }

    List<PreparedUnitItem> preparedItems = new ArrayList<>();
    BigDecimal totalMinutes = BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE);

    for (UnitEntryItemRequest item : request.unitItems()) {
      UnitType unitType = findUnitType(userId, item.unitTypeId());
      validationService.validateUnitType(unitType, workType);
      try {
        BigDecimal calculatedMinutes =
            UnitEntryItem.calculateMinutes(item.quantity(), unitType.getUnitsPerHour());
        preparedItems.add(new PreparedUnitItem(unitType, item.quantity(), calculatedMinutes, null, null, null));
        totalMinutes =
            totalMinutes.add(calculatedMinutes).setScale(WorkEntry.TIME_SCALE, RoundingMode.UNNECESSARY);
      } catch (IllegalArgumentException ex) {
        throw new ValidationException(ex.getMessage());
      }
    }

    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, request.workDate(), totalMinutes);
    return new PreparedWorkEntry(
        totalMinutes,
        salary,
        normalizeExtraPayPercentage(request.extraPayPercentage()),
        CompensationMethod.HOURLY,
        null,
        null,
        null,
        null,
        preparedItems);
  }

  private PreparedWorkEntry preparePerUnitEntry(
      UUID userId, WorkType workType, WorkEntryRequest request) {
    if (normalizeExtraPayPercentage(request.extraPayPercentage()) > 0) {
      throw new ValidationException("extraPayPercentage is not supported for PER_UNIT compensation");
    }

    List<PreparedUnitItem> preparedItems = new ArrayList<>();
    BigDecimal totalGross = BigDecimal.ZERO.setScale(WorkEntry.GROSS_SCALE);
    String currency = null;

    for (UnitEntryItemRequest item : request.unitItems()) {
      UnitType unitType = findUnitType(userId, item.unitTypeId());
      validationService.validateUnitType(unitType, workType);
      validationService.validatePerUnitType(unitType);
      try {
        BigDecimal calculatedMinutes =
            unitType.getUnitsPerHour() == null
                ? BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE)
                : UnitEntryItem.calculateMinutes(item.quantity(), unitType.getUnitsPerHour());
        BigDecimal itemGross = WorkEntry.calculatePerUnitGross(item.quantity(), unitType.getRatePerUnit());
        if (currency == null) {
          currency = unitType.getCurrency();
        } else if (!currency.equals(unitType.getCurrency())) {
          throw new ValidationException("All unit items in one entry must use the same currency");
        }
        preparedItems.add(
            new PreparedUnitItem(
                unitType,
                item.quantity(),
                calculatedMinutes,
                unitType.getRatePerUnit(),
                unitType.getCurrency(),
                itemGross));
        totalGross = totalGross.add(itemGross, WorkEntry.TIME_MATH_CONTEXT).setScale(WorkEntry.GROSS_SCALE, RoundingMode.HALF_UP);
      } catch (IllegalArgumentException ex) {
        throw new ValidationException(ex.getMessage());
      }
    }

    SalaryCalculationService.SalarySnapshot salary =
        new SalaryCalculationService.SalarySnapshot(BigDecimal.ZERO, currency, totalGross);
    return new PreparedWorkEntry(
        BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE),
        salary,
        0,
        CompensationMethod.PER_UNIT,
        totalGross,
        null,
        null,
        null,
        preparedItems);
  }

  private UnitType findUnitType(UUID userId, UUID unitTypeId) {
    return unitTypes
        .findByIdAndWorkTypeUserId(unitTypeId, userId)
        .orElseThrow(() -> new com.alveryn.api.common.exception.NotFoundException("UnitType", unitTypeId));
  }

  public record PreparedWorkEntry(
      BigDecimal calculatedMinutes,
      SalaryCalculationService.SalarySnapshot salary,
      int extraPayPercentage,
      CompensationMethod compensationMethod,
      BigDecimal grossAmount,
      java.time.LocalTime startTime,
      java.time.LocalTime endTime,
      Integer breakMinutes,
      List<PreparedUnitItem> unitItems) {}

  public record PreparedUnitItem(
      UnitType unitType,
      BigDecimal quantity,
      BigDecimal calculatedMinutes,
      BigDecimal ratePerUnit,
      String currency,
      BigDecimal grossAmount) {}

  private int normalizeExtraPayPercentage(Integer value) {
    return value == null ? 0 : value;
  }
}
