package com.alveryn.api.workrecord.service;

import com.alveryn.api.address.entity.Address;
import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.address.service.AddressService;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.restday.repository.EmploymentRestDayRepository;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.extrapay.EmploymentExtraPayRuleRepository;
import com.alveryn.api.employment.extrapay.EmploymentExtraPayRule;
import com.alveryn.api.employment.extrapay.EmploymentExtraPayTimeRule;
import com.alveryn.api.employment.extrapay.EmploymentExtraPayTimeRuleRepository;
import com.alveryn.api.workrecord.line.dto.ExtraPayDetailResponse;
import com.alveryn.api.time.TimeCalculator;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workrecord.calculation.WorkCalculation;
import com.alveryn.api.workrecord.dto.WorkRecordLineRequest;
import com.alveryn.api.workrecord.dto.WorkRecordRequest;
import com.alveryn.api.workrecord.dto.WorkRecordResponse;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.workrecord.line.dto.WorkRecordLineResponse;
import com.alveryn.api.workrecord.line.entity.WorkRecordLine;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.workproject.entity.WorkProject;
import com.alveryn.api.workrecord.entity.WorkEntryKind;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class WorkRecordService {
  private final WorkRecordRepository workRecords;
  private final WorkRecordLineRepository workRecordLines;
  private final WorkTypeRepository workTypes;
  private final SalaryCalculationService salaryCalculationService;
  private final UserAccountRepository users;
  private final AddressRepository addresses;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final EmploymentRestDayRepository restDays;
  private final EmploymentExtraPayRuleRepository extraPayRules;
  private final EmploymentExtraPayTimeRuleRepository extraPayTimeRules;

  @Transactional
  public WorkRecordResponse create(@Valid WorkRecordRequest request) {
    return createInternal(request, null, inferEntryKind(request));
  }

  @Transactional
  public WorkRecordResponse createSession(@Valid WorkRecordRequest request) {
    return createInternal(request, null, WorkEntryKind.WORK_SESSION);
  }

  @Transactional
  public WorkRecordResponse createForProject(WorkProject project, @Valid WorkRecordRequest request) {
    if (request.workEndDate() != null && !request.workEndDate().equals(request.workDate())) {
      throw new ValidationException("A project work session represents exactly one day");
    }
    return createInternal(request, project, WorkEntryKind.WORK_SESSION);
  }

  @Transactional
  public WorkRecordResponse createProjectTotal(WorkProject project, @Valid WorkRecordRequest request) {
    LocalDate expectedEnd = project.getEndDate() == null ? project.getStartDate() : project.getEndDate();
    LocalDate requestedEnd = request.workEndDate() == null ? request.workDate() : request.workEndDate();
    if (!project.getStartDate().equals(request.workDate()) || !expectedEnd.equals(requestedEnd)) {
      throw new ValidationException("Project totals must use the complete project period");
    }
    return createInternal(request, project, WorkEntryKind.WORK_RECORD);
  }

  private WorkRecordResponse createInternal(WorkRecordRequest request, WorkProject project, WorkEntryKind entryKind) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    UserAccount user = users.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));

    validateDateRange(request);
    Address address = request.addressId() == null && project != null
        ? project.getAddress()
        : resolveAddress(userId, request.addressId());
    WorkRecord record = new WorkRecord(user, address, request.workDate(), request.workEndDate(), request.teamSize(), request.notes());
    record.classifyAs(entryKind);
    record.assignEmployment(resolveRecordEmployment(userId, request));
    ensureNoRestDayOverlap(record, request);
    if (project != null) {
      if (record.getEmployment() == null || !project.getEmployment().getId().equals(record.getEmployment().getId()))
        throw new ValidationException("All work lines must use the project's employment");
      record.assignProject(project);
    }
    WorkRecord savedRecord = workRecords.save(record);
    persistLines(userId, savedRecord, request);
    return toResponse(savedRecord);
  }

  @Transactional(readOnly = true)
  public WorkRecordResponse get(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkRecord record =
        workRecords.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkRecord", id));
    return toResponse(record);
  }

  @Transactional(readOnly = true)
  public WorkRecord requireOwnedEntity(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    return workRecords.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkRecord", id));
  }

  @Transactional
  public WorkRecordResponse update(UUID id, @Valid WorkRecordRequest request) {
    return updateInternal(id, request, inferEntryKind(request));
  }

  @Transactional
  public WorkRecordResponse updateSession(UUID id, @Valid WorkRecordRequest request) {
    return updateInternal(id, request, WorkEntryKind.WORK_SESSION);
  }

  private WorkRecordResponse updateInternal(UUID id, WorkRecordRequest request, WorkEntryKind entryKind) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkRecord record =
        workRecords.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkRecord", id));

    replaceRecordLines(record.getId());

    validateDateRange(request);
    record.update(resolveAddress(userId, request.addressId()), request.workDate(), request.workEndDate(), request.teamSize(), request.notes());
    record.classifyAs(entryKind);
    record.assignEmployment(resolveRecordEmployment(userId, request));
    if (record.getProject() != null) {
      record.assignProject(record.getProject());
      if (entryKind == WorkEntryKind.WORK_RECORD
          && (!record.getWorkDate().equals(record.getProject().getStartDate())
          || !Objects.equals(record.getWorkEndDate(), record.getProject().getEndDate()))) {
        throw new ValidationException("Project totals must use the complete project period");
      }
    }
    ensureNoRestDayOverlap(record, request);
    persistLines(userId, record, request);
    return toResponse(record);
  }

  private WorkEntryKind inferEntryKind(WorkRecordRequest request) {
    return request.workEndDate() == null ? WorkEntryKind.WORK_SESSION : WorkEntryKind.WORK_RECORD;
  }

  private void ensureNoRestDayOverlap(WorkRecord record, WorkRecordRequest request) {
    if (record.getEmployment() == null) {
      return;
    }
    LocalDate endDate = request.workEndDate() == null ? request.workDate() : request.workEndDate();
    if (restDays.existsByEmploymentIdAndDateBetween(
        record.getEmployment().getId(), request.workDate(), endDate)) {
      throw new ConflictException("Work range overlaps a rest day");
    }
  }

  @Transactional
  public void delete(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkRecord record =
        workRecords.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkRecord", id));
    replaceRecordLines(record.getId());
    workRecords.delete(record);
    workRecords.flush();
  }

  @Transactional(readOnly = true)
  public List<WorkRecordResponse> listDay(LocalDate date) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    return toResponses(workRecords.findAllByUserIdAndWorkDateOrderByCreatedAtAsc(userId, date));
  }

  @Transactional(readOnly = true)
  public List<WorkRecordResponse> listRange(LocalDate fromDate, LocalDate toDate) {
    if (fromDate.isAfter(toDate)) {
      throw new ValidationException("from date must be before or equal to date");
    }
    UUID userId = authenticatedUserAccessor.requireUserId();
    return toResponses(workRecords.findAllOverlappingRange(userId, fromDate, toDate));
  }

  private List<WorkRecordResponse> toResponses(List<WorkRecord> records) {
    if (records.isEmpty()) return List.of();
    Map<UUID, List<WorkRecordLine>> linesByRecord = workRecordLines
        .findAllByWorkRecordIdIn(records.stream().map(WorkRecord::getId).toList())
        .stream()
        .collect(Collectors.groupingBy(
            line -> line.getWorkRecord().getId(), LinkedHashMap::new, Collectors.toList()));
    return records.stream()
        .map(record -> toResponse(record, linesByRecord.getOrDefault(record.getId(), List.of())))
        .toList();
  }

  private void persistLines(UUID userId, WorkRecord record, WorkRecordRequest request) {
    int displayOrder = 0;
    for (WorkRecordLineRequest line : request.lines()) {
      workRecordLines.save(toRecordLine(userId, record, line, displayOrder));
      displayOrder++;
    }
  }

  private com.alveryn.api.employment.entity.Employment resolveRecordEmployment(UUID userId, WorkRecordRequest request) {
    var employments = request.lines().stream().map(WorkRecordLineRequest::workTypeId).filter(java.util.Objects::nonNull)
        .map(id -> workTypes.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkType", id)))
        .map(WorkType::getEmployment).filter(java.util.Objects::nonNull).distinct().toList();
    if (employments.size() > 1) throw new ValidationException("A work record cannot mix different employments");
    return employments.isEmpty() ? null : employments.getFirst();
  }

  private void validateDateRange(WorkRecordRequest request) {
    if (request.workEndDate() != null && request.workEndDate().isBefore(request.workDate())) {
      throw new ValidationException("workEndDate must be on or after workDate");
    }
  }

  private void replaceRecordLines(UUID recordId) {
    workRecordLines.deleteAllByWorkRecordId(recordId);
    workRecordLines.flush();
  }

  private Address resolveAddress(UUID userId, UUID addressId) {
    if (addressId == null) {
      return null;
    }
    return addresses.findByIdAndUserId(addressId, userId).orElseThrow(() -> new NotFoundException("Address", addressId));
  }

  private WorkRecordLine toRecordLine(
      UUID userId, WorkRecord record, WorkRecordLineRequest request, int displayOrder) {
    if (request.workTypeId() == null) {
      throw new ValidationException("workTypeId is required");
    }
    UUID workTypeId = request.workTypeId();
    WorkType workType =
        workTypes
            .findByIdAndUserId(workTypeId, userId)
            .orElseThrow(() -> new NotFoundException("WorkType", workTypeId));
    try {
      if (workType.getEmployment() != null
          && workType.getEmployment().getCompensationType() == CompensationType.FIXED_SALARY
          && workType.calculationMode() == com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode.TIME_HOURLY) {
        return toTimeOnlyLine(record, workType, request, displayOrder);
      }
      return switch (workType.calculationMode()) {
        case TIME_HOURLY -> toTimeLine(userId, record, workType, request, displayOrder);
        case TIME_ONLY -> throw new ValidationException("TIME_ONLY is derived from employment compensation");
        case UNITS_PER_HOUR -> toUnitsPerHourLine(userId, record, workType, request, displayOrder);
        case UNITS_PER_UNIT -> toUnitsPerUnitLine(record, workType, request, displayOrder);
        case FIXED_AMOUNT -> toFixedAmountLine(record, workType, request, displayOrder);
      };
    } catch (IllegalArgumentException ex) {
      throw new ValidationException(ex.getMessage());
    }
  }

  private WorkRecordLine toTimeOnlyLine(WorkRecord record, WorkType workType,
      WorkRecordLineRequest request, int displayOrder) {
    int breakMinutes = request.unpaidBreakMinutes() == null ? 0 : request.unpaidBreakMinutes();
    if (request.durationMinutes() != null) return WorkRecordLine.timeOnlyDuration(record, workType, displayOrder, request.durationMinutes(), request.notes());
    if (request.startTime() == null || request.endTime() == null) throw new ValidationException("startTime and endTime are required");
    return WorkRecordLine.timeOnly(record, workType, displayOrder, request.startTime(), request.endTime(), breakMinutes, request.notes());
  }

  private WorkRecordLine toTimeLine(
      UUID userId,
      WorkRecord record,
      WorkType workType,
      WorkRecordLineRequest request,
      int displayOrder) {
    if (request.durationMinutes() != null && request.durationMinutes() > 0) {
      return toTimeDurationLine(userId, record, workType, request, displayOrder);
    }
    if (request.startTime() == null || request.endTime() == null) {
      throw new ValidationException("startTime/endTime or durationMinutes is required");
    }
    int breakMinutes =
        request.unpaidBreakMinutes() != null
            ? request.unpaidBreakMinutes()
            : workType.getDefaultBreakMinutes() != null ? workType.getDefaultBreakMinutes() : 0;
    BigDecimal workedMinutes =
        BigDecimal.valueOf(TimeCalculator.intervalMinutes(request.startTime(), request.endTime()) - breakMinutes);
    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, requireEmploymentId(record), record.getWorkDate(), workedMinutes);
    return WorkRecordLine.timeHourly(
        record,
        workType,
        displayOrder,
        request.startTime(),
        request.endTime(),
        breakMinutes,
        salary.hourlyRate(),
        salary.currency(),
        resolveExtraPayPercentage(record, workType, request, workedMinutes.intValueExact()),
        request.notes());
  }

  private WorkRecordLine toTimeDurationLine(
      UUID userId,
      WorkRecord record,
      WorkType workType,
      WorkRecordLineRequest request,
      int displayOrder) {
    int durationMinutes = request.durationMinutes();
    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, requireEmploymentId(record), record.getWorkDate(), BigDecimal.valueOf(durationMinutes));
    return WorkRecordLine.timeHourlyDuration(
            record,
            workType,
            displayOrder,
            durationMinutes,
            salary.hourlyRate(),
            salary.currency(),
            resolveExtraPayPercentage(record, workType, request),
            request.notes());
  }

  private WorkRecordLine toUnitsPerHourLine(
      UUID userId,
      WorkRecord record,
      WorkType workType,
      WorkRecordLineRequest request,
      int displayOrder) {
    BigDecimal quantity = requireQuantity(request);
    int workers = teamworkEnabled(workType) ? requireTeamSize(record) : 1;
    BigDecimal calculatedMinutes =
        quantity
            .multiply(BigDecimal.valueOf(60), WorkCalculation.TIME_MATH_CONTEXT)
            .divide(workType.getUnitsPerHour(), WorkCalculation.TIME_MATH_CONTEXT)
            .divide(BigDecimal.valueOf(workers), WorkCalculation.TIME_MATH_CONTEXT)
            .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, requireEmploymentId(record), record.getWorkDate(), calculatedMinutes);
    return WorkRecordLine.unitsPerHour(
        record,
        workType,
        displayOrder,
        quantity,
        workers,
        salary.hourlyRate(),
        salary.currency(),
        resolveExtraPayPercentage(record, workType, request),
        request.notes());
  }

  private boolean teamworkEnabled(WorkType workType) {
    return workType.isTeamworkEnabled()
        || (workType.getParent() != null && workType.getParent().isTeamworkEnabled());
  }

  private int requireTeamSize(WorkRecord record) {
    if (record.getTeamSize() == null || record.getTeamSize() <= 0) {
      throw new IllegalArgumentException("teamSize is required for teamwork work types");
    }
    return record.getTeamSize();
  }

  private WorkRecordLine toUnitsPerUnitLine(
      WorkRecord record, WorkType workType, WorkRecordLineRequest request, int displayOrder) {
    return WorkRecordLine.unitsPerUnit(
        record, workType, displayOrder, requireQuantity(request), record.getTeamSize(),
        resolveExtraPayPercentage(record, workType, request), request.notes());
  }

  private WorkRecordLine toFixedAmountLine(
      WorkRecord record, WorkType workType, WorkRecordLineRequest request, int displayOrder) {
    if (request.fixedAmount() == null || request.fixedAmount().signum() <= 0) {
      throw new ValidationException("fixedAmount must be positive");
    }
    if (request.currency() == null || request.currency().isBlank()) {
      throw new ValidationException("currency is required for fixed amount work");
    }
    return WorkRecordLine.fixedAmount(
        record, workType, displayOrder, request.fixedAmount(), request.currency(),
        resolveExtraPayPercentage(record, workType, request), request.notes());
  }

  private BigDecimal requireQuantity(WorkRecordLineRequest request) {
    if (request.quantity() == null || request.quantity().signum() <= 0) {
      throw new ValidationException("quantity must be positive");
    }
    return request.quantity();
  }

  private UUID requireEmploymentId(WorkRecord record) {
    if (record.getEmployment() == null) throw new ValidationException("Employment is required for paid work");
    return record.getEmployment().getId();
  }

  private BigDecimal normalizeExtraPayPercentage(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }

  private BigDecimal resolveExtraPayPercentage(
      WorkRecord record, WorkType workType, WorkRecordLineRequest request) {
    return resolveExtraPayPercentage(record, workType, request, null);
  }

  private BigDecimal resolveExtraPayPercentage(
      WorkRecord record, WorkType workType, WorkRecordLineRequest request,
      Integer actualWorkedMinutes) {
    boolean extraPayEnabled = workType.isExtraPayEnabled()
        || (workType.getParent() != null && workType.getParent().isExtraPayEnabled());
    BigDecimal manual = extraPayEnabled
        ? normalizeExtraPayPercentage(request.extraPayPercentage()) : BigDecimal.ZERO;
    if (record.getEmployment() == null) return manual;
    BigDecimal recurring = extraPayRules.findByEmploymentIdAndWeekday(
            record.getEmployment().getId(), record.getWorkDate().getDayOfWeek())
        .map(EmploymentExtraPayRule::getPercentage).orElse(BigDecimal.ZERO);
    if (request.startTime() != null && request.endTime() != null) {
      int workedMinutes = actualWorkedMinutes != null
          ? actualWorkedMinutes
          : TimeCalculator.intervalMinutes(request.startTime(), request.endTime())
              - (request.unpaidBreakMinutes() == null ? 0 : request.unpaidBreakMinutes());
      if (workedMinutes > 0) {
        BigDecimal intervalPercentage = extraPayTimeRules.findAllByEmploymentIdOrderByStartTime(record.getEmployment().getId())
            .stream()
            .map(rule -> effectiveIntervalPercentage(request.startTime(), request.endTime(), workedMinutes, rule))
            .max(BigDecimal::compareTo)
            .orElse(BigDecimal.ZERO);
        recurring = recurring.max(intervalPercentage);
      }
    }
    return manual.max(recurring);
  }

  private BigDecimal effectiveIntervalPercentage(LocalTime workStart, LocalTime workEnd, int workedMinutes,
      EmploymentExtraPayTimeRule rule) {
    int overlap = overlapMinutes(workStart, workEnd, workedMinutes, rule);
    return rule.getPercentage().multiply(BigDecimal.valueOf(overlap))
        .divide(BigDecimal.valueOf(workedMinutes), 6, RoundingMode.HALF_UP);
  }

  private int overlapMinutes(LocalTime workStart, LocalTime workEnd, int workedMinutes,
      EmploymentExtraPayTimeRule rule) {
    int workStartMinute = workStart.toSecondOfDay() / 60;
    int workEndMinute = workEnd.toSecondOfDay() / 60;
    if (workEndMinute <= workStartMinute) workEndMinute += 1440;
    int ruleStart = rule.getStartTime().toSecondOfDay() / 60;
    int ruleEnd = rule.getEndTime().toSecondOfDay() / 60;
    if (ruleEnd <= ruleStart) ruleEnd += 1440;
    int overlap = 0;
    for (int offset : new int[] {-1440, 0, 1440}) {
      overlap = Math.max(overlap,
          Math.max(0, Math.min(workEndMinute, ruleEnd + offset) - Math.max(workStartMinute, ruleStart + offset)));
    }
    overlap = Math.min(overlap, workedMinutes);
    return overlap;
  }

  private WorkRecordResponse toResponse(WorkRecord record) {
    List<WorkRecordLineResponse> recordLines = workRecordLines
        .findAllByWorkRecordIdOrderByDisplayOrderAscCreatedAtAsc(record.getId()).stream()
        .map(this::toLineResponse)
        .toList();
    return assembleResponse(record, recordLines);
  }

  private WorkRecordResponse toResponse(WorkRecord record, List<WorkRecordLine> lines) {
    return assembleResponse(record, lines.stream().map(this::toLineResponse).toList());
  }

  private WorkRecordResponse assembleResponse(
      WorkRecord record, List<WorkRecordLineResponse> recordLines) {
    BigDecimal calculatedMinutes =
        recordLines.stream().map(WorkRecordLineResponse::calculatedMinutes).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal workedMinutes = sum(recordLines, WorkRecordLineResponse::workedMinutes);
    BigDecimal extraPaidEquivalentMinutes = sum(recordLines, WorkRecordLineResponse::extraPaidEquivalentMinutes);
    BigDecimal totalPaidEquivalentMinutes = sum(recordLines, WorkRecordLineResponse::totalPaidEquivalentMinutes);
    BigDecimal baseGrossAmount = sum(recordLines, WorkRecordLineResponse::baseGrossAmount);
    BigDecimal extraGrossAmount = sum(recordLines, WorkRecordLineResponse::extraGrossAmount);
    BigDecimal totalGrossAmount = sum(recordLines, WorkRecordLineResponse::totalGrossAmount);
    return new WorkRecordResponse(
        record.getId(),
        record.getEntryKind(),
        record.getEmployment() == null ? null : record.getEmployment().getId(),
        record.getProject() == null ? null : record.getProject().getId(),
        record.getProject() == null ? null : record.getProject().getTitle(),
        record.getProject() == null ? null : record.getProject().getNotes(),
        record.getWorkDate(),
        record.getWorkEndDate(),
        record.getAddress() == null ? null : record.getAddress().getId(),
        AddressService.toResponse(record.getAddress()),
        record.getTeamSize(),
        record.getNotes(),
        calculatedMinutes,
        workedMinutes.divide(BigDecimal.valueOf(60), 15, RoundingMode.HALF_UP),
        workedMinutes,
        extraPaidEquivalentMinutes,
        totalPaidEquivalentMinutes,
        totalGrossAmount,
        baseGrossAmount,
        extraGrossAmount,
        totalGrossAmount,
        resolveCurrency(recordLines),
        recordLines,
        record.getCreatedAt(),
        record.getUpdatedAt());
  }

  private String resolveCurrency(List<WorkRecordLineResponse> recordLines) {
    if (recordLines.isEmpty()) {
      return null;
    }
    return recordLines.stream().map(WorkRecordLineResponse::currencySnapshot).distinct().limit(2).count() == 1
        ? recordLines.getFirst().currencySnapshot()
        : null;
  }

  private BigDecimal sum(
      List<WorkRecordLineResponse> lines,
      java.util.function.Function<WorkRecordLineResponse, BigDecimal> value) {
    return lines.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private WorkRecordLineResponse toLineResponse(WorkRecordLine line) {
    return new WorkRecordLineResponse(
        line.getId(),
        line.getWorkType().getId(),
        line.getDisplayOrder(),
        line.getWorkTypeNameSnapshot(),
        line.getConfigurationNameSnapshot(),
        line.getWorkType().getParent() == null ? null : line.getWorkType().getParent().getName(),
        line.getCalculationModeSnapshot(),
        line.getUnitLabelSnapshot(),
        line.getUnitSymbolSnapshot(),
        line.getQuantity(),
        line.getFixedAmountSnapshot(),
        line.getUnitsPerHourSnapshot(),
        line.getStartTime(),
        line.getEndTime(),
        line.getDurationMinutes(),
        line.getBreakMinutes(),
        line.getCalculatedMinutes(),
        line.getWorkedMinutes().divide(BigDecimal.valueOf(60), 15, RoundingMode.HALF_UP),
        line.getWorkedMinutes(),
        line.getExtraPaidEquivalentMinutes(),
        line.getTotalPaidEquivalentMinutes(),
        line.getHourlyRateSnapshot(),
        line.getRatePerUnitSnapshot(),
        line.getCurrencySnapshot(),
        line.getGrossAmount(),
        line.getBaseGrossAmount(),
        line.getExtraGrossAmount(),
        line.getTotalGrossAmount(),
        line.getExtraPayPercentage(),
        extraPayDetails(line),
        line.getNotes());
  }

  private List<ExtraPayDetailResponse> extraPayDetails(WorkRecordLine line) {
    if (line.getStartTime() == null || line.getEndTime() == null
        || line.getWorkRecord().getEmployment() == null) return List.of();
    int workedMinutes = line.getWorkedMinutes().intValue();
    if (workedMinutes <= 0) return List.of();
    return extraPayTimeRules.findAllByEmploymentIdOrderByStartTime(
            line.getWorkRecord().getEmployment().getId()).stream()
        .map(rule -> new ExtraPayDetailResponse(
            rule.getName(),
            BigDecimal.valueOf(overlapMinutes(
                line.getStartTime(), line.getEndTime(), workedMinutes, rule)),
            rule.getPercentage()))
        .filter(detail -> detail.eligibleMinutes().signum() > 0)
        .toList();
  }

}
