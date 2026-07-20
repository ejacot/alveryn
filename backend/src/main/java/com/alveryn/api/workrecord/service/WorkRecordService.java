package com.alveryn.api.workrecord.service;

import com.alveryn.api.address.entity.Address;
import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.address.service.AddressService;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.employment.entity.TrackingFocus;
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
import java.util.List;
import java.util.UUID;
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

  private WorkRecordResponse createInternal(WorkRecordRequest request, WorkProject project, WorkEntryKind entryKind) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    UserAccount user = users.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));

    validateDateRange(request);
    WorkRecord record = new WorkRecord(user, resolveAddress(userId, request.addressId()), request.workDate(), request.workEndDate(), request.teamSize(), request.notes());
    record.classifyAs(entryKind);
    record.assignEmployment(resolveRecordEmployment(userId, request));
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
    persistLines(userId, record, request);
    return toResponse(record);
  }

  private WorkEntryKind inferEntryKind(WorkRecordRequest request) {
    return request.workEndDate() == null ? WorkEntryKind.WORK_SESSION : WorkEntryKind.WORK_RECORD;
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
    return workRecords.findAllByUserIdAndWorkDateOrderByCreatedAtAsc(userId, date).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<WorkRecordResponse> listRange(LocalDate fromDate, LocalDate toDate) {
    if (fromDate.isAfter(toDate)) {
      throw new ValidationException("from date must be before or equal to date");
    }
    UUID userId = authenticatedUserAccessor.requireUserId();
    return workRecords.findAllOverlappingRange(userId, fromDate, toDate)
        .stream()
        .map(this::toResponse)
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
          && workType.getEmployment().getTrackingFocus() == TrackingFocus.TIME
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
        resolveExtraPayPercentage(workType, request),
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
            resolveExtraPayPercentage(workType, request),
            request.notes());
  }

  private WorkRecordLine toUnitsPerHourLine(
      UUID userId,
      WorkRecord record,
      WorkType workType,
      WorkRecordLineRequest request,
      int displayOrder) {
    BigDecimal quantity = requireQuantity(request);
    BigDecimal calculatedMinutes =
        quantity
            .multiply(BigDecimal.valueOf(60), WorkCalculation.TIME_MATH_CONTEXT)
            .divide(workType.getUnitsPerHour(), WorkCalculation.TIME_MATH_CONTEXT)
            .setScale(WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);
    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, requireEmploymentId(record), record.getWorkDate(), calculatedMinutes);
    return WorkRecordLine.unitsPerHour(
        record,
        workType,
        displayOrder,
        quantity,
        salary.hourlyRate(),
        salary.currency(),
        resolveExtraPayPercentage(workType, request),
        request.notes());
  }

  private WorkRecordLine toUnitsPerUnitLine(
      WorkRecord record, WorkType workType, WorkRecordLineRequest request, int displayOrder) {
    return WorkRecordLine.unitsPerUnit(
        record, workType, displayOrder, requireQuantity(request), record.getTeamSize(),
        resolveExtraPayPercentage(workType, request), request.notes());
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
        resolveExtraPayPercentage(workType, request), request.notes());
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

  private int normalizeExtraPayPercentage(Integer value) {
    return value == null ? 0 : value;
  }

  private int resolveExtraPayPercentage(WorkType workType, WorkRecordLineRequest request) {
    return workType.isExtraPayEnabled() ? normalizeExtraPayPercentage(request.extraPayPercentage()) : 0;
  }

  private WorkRecordResponse toResponse(WorkRecord record) {
    List<WorkRecordLineResponse> recordLines =
        workRecordLines.findAllByWorkRecordIdOrderByDisplayOrderAscCreatedAtAsc(record.getId()).stream()
            .map(this::toLineResponse)
            .toList();
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
        line.getNotes());
  }

}
