package com.roomly.api.workentry.service;

import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.salary.service.SalaryCalculationService;
import com.roomly.api.workentry.dto.*;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.UnitTypeRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Month;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class WorkEntryService {
  private final WorkEntryRepository workEntries;
  private final TimeEntryDetailsRepository timeEntryDetails;
  private final UnitEntryItemRepository unitEntryItems;
  private final WorkTypeRepository workTypes;
  private final UnitTypeRepository unitTypes;
  private final AbsenceRepository absences;
  private final SalaryCalculationService salaryCalculationService;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

  @Transactional
  public WorkEntryResponse create(@Valid WorkEntryRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkType workType = findWorkType(userId, request.workTypeId());
    ensureNoAbsenceConflict(userId, request.workDate());

    PreparedEntry prepared = prepareEntry(userId, workType, request);
    WorkEntry entry =
        new WorkEntry(
            workType.getUser(),
            workType,
            request.workDate(),
            prepared.salary().hourlyRate(),
            prepared.salary().currency(),
            prepared.calculatedMinutes());
    entry.updateNotes(request.notes());
    WorkEntry saved = workEntries.save(entry);
    persistDetails(saved, prepared);
    return toResponse(saved);
  }

  @Transactional(readOnly = true)
  public Page<WorkEntryResponse> list(
      Integer year, Integer month, UUID workTypeId, Pageable pageable) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    DateRange range = resolveRange(year, month);
    Pageable effectivePageable =
        pageable.getSort().isSorted()
            ? pageable
            : PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(Sort.Order.desc("workDate"), Sort.Order.desc("createdAt")));
    Page<WorkEntry> page =
        findPage(userId, range.fromDate(), range.toDate(), workTypeId, effectivePageable);
    List<WorkEntryResponse> content = page.getContent().stream().map(this::toResponse).toList();
    return new PageImpl<>(content, effectivePageable, page.getTotalElements());
  }

  @Transactional(readOnly = true)
  public WorkEntryResponse get(UUID id) {
    return toResponse(findEntry(authenticatedUserAccessor.requireUserId(), id));
  }

  @Transactional
  public WorkEntryResponse update(UUID id, @Valid WorkEntryRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkEntry entry = findEntry(userId, id);
    WorkType workType = findWorkType(userId, request.workTypeId());
    ensureNoAbsenceConflict(userId, request.workDate());

    PreparedEntry prepared = prepareEntry(userId, workType, request);
    entry.recalculate(
        workType,
        request.workDate(),
        prepared.salary().hourlyRate(),
        prepared.salary().currency(),
        prepared.calculatedMinutes());
    entry.updateNotes(request.notes());

    timeEntryDetails.deleteByWorkEntryId(id);
    unitEntryItems.deleteAllByWorkEntryId(id);
    timeEntryDetails.flush();
    unitEntryItems.flush();
    persistDetails(entry, prepared);
    return toResponse(entry);
  }

  @Transactional
  public void delete(UUID id) {
    workEntries.delete(findEntry(authenticatedUserAccessor.requireUserId(), id));
  }

  private PreparedEntry prepareEntry(UUID userId, WorkType workType, WorkEntryRequest request) {
    if (!workType.isActive()) {
      throw new ValidationException("Work type must be active");
    }

    return switch (workType.getCalculationMethod()) {
      case TIME_BASED -> prepareTimeBasedEntry(userId, workType, request);
      case UNIT_BASED -> prepareUnitBasedEntry(userId, workType, request);
    };
  }

  private PreparedEntry prepareTimeBasedEntry(UUID userId, WorkType workType, WorkEntryRequest request) {
    if (request.startTime() == null || request.endTime() == null) {
      throw new ValidationException("startTime and endTime are required for TIME_BASED entries");
    }
    if (request.unitItems() != null && !request.unitItems().isEmpty()) {
      throw new ValidationException("unitItems are not allowed for TIME_BASED entries");
    }

    int breakMinutes =
        request.unpaidBreakMinutes() != null
            ? request.unpaidBreakMinutes()
            : workType.getDefaultBreakMinutes() != null ? workType.getDefaultBreakMinutes() : 0;

    try {
      int totalIntervalMinutes = TimeEntryDetails.intervalMinutes(request.startTime(), request.endTime());
      if (breakMinutes < 0) {
        throw new ValidationException("breakMinutes must be non-negative");
      }
      if (breakMinutes >= totalIntervalMinutes) {
        throw new ValidationException("break must be shorter than interval");
      }
      int workedMinutes = totalIntervalMinutes - breakMinutes;
      SalaryCalculationService.SalarySnapshot salary =
          salaryCalculationService.calculateForDate(
              userId, request.workDate(), BigDecimal.valueOf(workedMinutes));
      return new PreparedEntry(
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

  private PreparedEntry prepareUnitBasedEntry(UUID userId, WorkType workType, WorkEntryRequest request) {
    if (request.startTime() != null || request.endTime() != null || request.unpaidBreakMinutes() != null) {
      throw new ValidationException("time fields are not allowed for UNIT_BASED entries");
    }
    if (request.unitItems() == null || request.unitItems().isEmpty()) {
      throw new ValidationException("At least one unit item is required for UNIT_BASED entries");
    }

    List<PreparedUnitItem> preparedItems = new ArrayList<>();
    Set<UUID> seenUnitTypes = new HashSet<>();
    BigDecimal totalMinutes = BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE);

    for (UnitEntryItemRequest item : request.unitItems()) {
      if (!seenUnitTypes.add(item.unitTypeId())) {
        throw new ValidationException("Each unit type can appear only once in a work entry");
      }
      UnitType unitType = findUnitType(userId, item.unitTypeId());
      if (!unitType.isActive()) {
        throw new ValidationException("Unit type must be active");
      }
      if (!unitType.getWorkType().getId().equals(workType.getId())) {
        throw new ValidationException("Unit type does not belong to the selected work type");
      }
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
    return new PreparedEntry(totalMinutes, salary, null, null, null, preparedItems);
  }

  private void persistDetails(WorkEntry entry, PreparedEntry prepared) {
    if (entry.getCalculationMethodSnapshot() == CalculationMethod.TIME_BASED) {
      timeEntryDetails.save(
          new TimeEntryDetails(entry, prepared.startTime(), prepared.endTime(), prepared.breakMinutes()));
      return;
    }
    for (PreparedUnitItem item : prepared.unitItems()) {
      unitEntryItems.save(new UnitEntryItem(entry, item.unitType(), item.quantity()));
    }
  }

  private WorkEntryResponse toResponse(WorkEntry entry) {
    TimeEntryDetailsResponse timeResponse =
        timeEntryDetails
            .findByWorkEntryId(entry.getId())
            .map(
                time ->
                    new TimeEntryDetailsResponse(
                        time.getStartTime(),
                        time.getEndTime(),
                        time.getBreakMinutes(),
                        time.getTotalIntervalMinutes(),
                        time.getWorkedMinutes()))
            .orElse(null);

    List<UnitEntryItemResponse> unitResponses =
        unitEntryItems.findAllByWorkEntryId(entry.getId()).stream()
            .map(
                item ->
                    new UnitEntryItemResponse(
                        item.getId(),
                        item.getUnitType().getId(),
                        item.getUnitNameSnapshot(),
                        item.getQuantity(),
                        item.getUnitsPerHourSnapshot(),
                        item.getCalculatedMinutes()))
            .toList();

    return new WorkEntryResponse(
        entry.getId(),
        entry.getWorkType().getId(),
        entry.getWorkTypeNameSnapshot(),
        entry.getCalculationMethodSnapshot(),
        entry.getWorkDate(),
        entry.getHourlyRateSnapshot(),
        entry.getCurrencySnapshot(),
        entry.getCalculatedMinutes(),
        entry.getCalculatedMinutes()
            .divide(BigDecimal.valueOf(60), WorkEntry.TIME_SCALE, RoundingMode.HALF_UP),
        entry.getGrossAmount(),
        entry.getNotes(),
        timeResponse,
        unitResponses,
        entry.getCreatedAt(),
        entry.getUpdatedAt());
  }

  private Page<WorkEntry> findPage(
      UUID userId, LocalDate fromDate, LocalDate toDate, UUID workTypeId, Pageable pageable) {
    if (workTypeId == null && fromDate == null) {
      return workEntries.findAllByUserId(userId, pageable);
    }
    if (workTypeId == null) {
      return workEntries.findAllByUserIdAndWorkDateBetween(userId, fromDate, toDate, pageable);
    }
    if (fromDate == null) {
      return workEntries.findAllByUserIdAndWorkTypeId(userId, workTypeId, pageable);
    }
    return workEntries.findAllByUserIdAndWorkTypeIdAndWorkDateBetween(
        userId, workTypeId, fromDate, toDate, pageable);
  }

  private WorkEntry findEntry(UUID userId, UUID id) {
    return workEntries
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("WorkEntry", id));
  }

  private WorkType findWorkType(UUID userId, UUID workTypeId) {
    return workTypes
        .findByIdAndUserId(workTypeId, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", workTypeId));
  }

  private UnitType findUnitType(UUID userId, UUID unitTypeId) {
    return unitTypes
        .findByIdAndWorkTypeUserId(unitTypeId, userId)
        .orElseThrow(() -> new NotFoundException("UnitType", unitTypeId));
  }

  private void ensureNoAbsenceConflict(UUID userId, LocalDate workDate) {
    if (absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
        userId, workDate, workDate)) {
      throw new ConflictException("A work entry cannot exist on a day with an absence");
    }
  }

  private DateRange resolveRange(Integer year, Integer month) {
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

  private record PreparedEntry(
      BigDecimal calculatedMinutes,
      SalaryCalculationService.SalarySnapshot salary,
      LocalTime startTime,
      LocalTime endTime,
      Integer breakMinutes,
      List<PreparedUnitItem> unitItems) {}

  private record PreparedUnitItem(
      UnitType unitType, BigDecimal quantity, BigDecimal calculatedMinutes) {}

  private record DateRange(LocalDate fromDate, LocalDate toDate) {}
}
