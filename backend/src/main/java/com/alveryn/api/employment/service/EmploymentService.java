package com.alveryn.api.employment.service;
import com.alveryn.api.absence.repository.AbsenceRepository;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.employment.dto.*;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.employment.repository.EmploymentTermRepository;
import com.alveryn.api.employment.entity.EmploymentTerm;
import com.alveryn.api.employment.entity.TrackingFocus;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class EmploymentService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final EmploymentRepository repository;
  private final UserAccountRepository users;
  private final WorkRecordLineRepository workRecordLines;
  private final WorkRecordRepository workRecords;
  private final AbsenceRepository absences;
  private final WorkTypeRepository workTypes;
  private final EmploymentTermRepository terms;

  @Transactional(readOnly = true) public List<EmploymentResponse> list() {
    return repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(authenticatedUserAccessor.requireUserId()).stream().map(this::response).toList();
  }
  @Transactional(readOnly = true) public EmploymentResponse get(UUID id) { return response(requireOwned(id)); }
  @Transactional public EmploymentResponse create(EmploymentRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var user = users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var entity = new Employment(user, request.name());
    configure(entity, request, repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).size());
    Employment saved = repository.save(entity);
    LocalDate validFrom = request.termsValidFrom() != null ? request.termsValidFrom()
        : request.startDate() != null ? request.startDate() : LocalDate.now();
    terms.save(new EmploymentTerm(saved, validFrom, compensationType(request), fixedSalaryAmount(request),
        currency(request), targetMinutes(request), targetPeriod(request)));
    return response(saved);
  }
  @Transactional public EmploymentResponse update(UUID id, EmploymentRequest request) {
    var entity = requireOwned(id);
    entity.rename(request.name());
    LocalDate validFrom = request.termsValidFrom() != null ? request.termsValidFrom() : LocalDate.now();
    EmploymentTerm current = terms.findFirstByEmploymentIdOrderByValidFromDesc(id).orElse(null);
    if (current == null) {
      terms.save(new EmploymentTerm(entity, validFrom, compensationType(request), fixedSalaryAmount(request), currency(request), targetMinutes(request), targetPeriod(request)));
    } else if (!current.sameTerms(compensationType(request), fixedSalaryAmount(request), currency(request), targetMinutes(request), targetPeriod(request))) {
      EmploymentTerm sameStart = terms.findByEmploymentIdAndValidFrom(id, validFrom).orElse(null);
      if (sameStart != null) {
        sameStart.configure(compensationType(request), fixedSalaryAmount(request), currency(request), targetMinutes(request), targetPeriod(request));
      } else {
        if (!validFrom.isAfter(current.getValidFrom())) throw new IllegalArgumentException("termsValidFrom must be after the latest contractual terms");
        current.endBefore(validFrom);
        terms.save(new EmploymentTerm(entity, validFrom, compensationType(request), fixedSalaryAmount(request), currency(request), targetMinutes(request), targetPeriod(request)));
      }
    }
    configure(entity, request, entity.getDisplayOrder());
    return response(entity);
  }
  @Transactional public void delete(UUID id) {
    var entity = requireOwned(id);
    if (isDeletable(entity)) {
      repository.delete(entity);
      return;
    }
    TrackingFocus trackingFocus = entity.getTrackingFocus();
    boolean hourBalanceEnabled = entity.isHourBalanceEnabled();
    boolean timerEnabled = entity.isTimerEnabled();
    entity.configure(entity.getEmploymentType(), entity.getCompensationType(), entity.getStartDate(), entity.getEndDate(), entity.getFixedSalaryAmount(), entity.getCurrency(), entity.getTargetMinutes(), entity.getTargetPeriod(), entity.getHourBalanceValidityMonths(), false, entity.getDisplayOrder());
    entity.configureTracking(trackingFocus, hourBalanceEnabled);
    entity.configureTimer(timerEnabled);
  }
  @Transactional(readOnly = true) public EmploymentHourBalanceResponse hourBalance(UUID id, YearMonth month) {
    Employment employment = requireOwned(id);
    if (!employment.isHourBalanceEnabled())
      throw new IllegalArgumentException("Hour balance is not enabled for this employment");
    YearMonth first = employment.getStartDate() == null ? month : YearMonth.from(employment.getStartDate());
    if (month.isBefore(first)) throw new IllegalArgumentException("month is before employment start");
    LocalDate monthFrom = employment.getStartDate() != null && employment.getStartDate().isAfter(month.atDay(1))
        ? employment.getStartDate() : month.atDay(1);
    LocalDate monthTo = employment.getEndDate() != null && employment.getEndDate().isBefore(month.atEndOfMonth())
        ? employment.getEndDate() : month.atEndOfMonth();
    long monthlyTarget = monthFrom.isAfter(monthTo) ? 0 : targetMinutesBetween(id, monthFrom, monthTo);
    long monthWorked = workRecordLines.sumTimeOnlyMinutes(id, month.atDay(1), month.atEndOfMonth()).longValue();
    LocalDate employmentFrom = employment.getStartDate() == null ? first.atDay(1) : employment.getStartDate();
    int validityMonths = Objects.requireNonNullElse(employment.getHourBalanceValidityMonths(), 12);
    LocalDate validityFrom = month.atDay(1).minusMonths(validityMonths - 1L);
    LocalDate balanceFrom = employmentFrom.isAfter(validityFrom) ? employmentFrom : validityFrom;
    LocalDate balanceTo = employment.getEndDate() != null && employment.getEndDate().isBefore(month.atEndOfMonth())
        ? employment.getEndDate() : month.atEndOfMonth();
    long workedToMonth = workRecordLines.sumTimeOnlyMinutes(id, balanceFrom, balanceTo).longValue();
    long targetToMonth = balanceFrom.isAfter(balanceTo) ? 0 : targetMinutesBetween(id, balanceFrom, balanceTo);
    long carried = workedToMonth - targetToMonth;
    return new EmploymentHourBalanceResponse(id, month, monthWorked, monthlyTarget, monthWorked - monthlyTarget,
        carried, balanceFrom, validityMonths);
  }
  private void configure(Employment e, EmploymentRequest r, int fallbackOrder) {
    boolean balanceEnabled = hourBalanceEnabled(r);
    e.configure(r.employmentType(), compensationType(r), r.startDate(), r.endDate(),
        fixedSalaryAmount(r), currency(r), targetMinutes(r), targetPeriod(r),
        balanceEnabled ? r.hourBalanceValidityMonths() : null,
        r.active() == null || r.active(), r.displayOrder() == null ? fallbackOrder : r.displayOrder());
    e.configureTracking(trackingFocus(r), balanceEnabled);
    e.configureTimer(r.timerEnabled() == null ? (e.getId() == null
        ? trackingFocus(r) == TrackingFocus.TIME : e.isTimerEnabled()) : r.timerEnabled());
  }

  private TrackingFocus trackingFocus(EmploymentRequest request) {
    if (request.trackingFocus() != null) return request.trackingFocus();
    return request.compensationType() == CompensationType.FIXED_SALARY ? TrackingFocus.TIME : TrackingFocus.EARNINGS;
  }

  private boolean hourBalanceEnabled(EmploymentRequest request) {
    return request.hourBalanceEnabled() == null
        ? request.compensationType() == CompensationType.FIXED_SALARY
        : request.hourBalanceEnabled();
  }

  private CompensationType compensationType(EmploymentRequest request) {
    if (request.compensationType() != null) return request.compensationType();
    if (request.trackingFocus() == null) {
      return Objects.requireNonNull(request.compensationType(), "compensationType or trackingFocus is required");
    }
    return hourBalanceEnabled(request) ? CompensationType.FIXED_SALARY : CompensationType.HOURLY;
  }

  private java.math.BigDecimal fixedSalaryAmount(EmploymentRequest request) {
    return request.fixedSalaryAmount();
  }

  private String currency(EmploymentRequest request) {
    return request.currency();
  }

  private Integer targetMinutes(EmploymentRequest request) {
    return hourBalanceEnabled(request) || compensationType(request) == CompensationType.FIXED_SALARY
        ? request.targetMinutes() : null;
  }

  private com.alveryn.api.employment.entity.TargetPeriod targetPeriod(EmploymentRequest request) {
    return hourBalanceEnabled(request) || compensationType(request) == CompensationType.FIXED_SALARY
        ? request.targetPeriod() : null;
  }
  public Employment requireOwned(UUID id) { UUID userId = authenticatedUserAccessor.requireUserId(); return repository.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("Employment", id)); }
  private boolean isDeletable(Employment e) {
    return !workTypes.existsByEmploymentId(e.getId())
        && !workRecords.existsByEmploymentId(e.getId())
        && !absences.existsByEmploymentId(e.getId());
  }
  private EmploymentTerm effectiveTerm(UUID employmentId, LocalDate date) {
    List<EmploymentTerm> matches = terms.findEffective(employmentId, date);
    if (matches.isEmpty()) throw new IllegalArgumentException("No contractual terms for date " + date);
    return matches.getFirst();
  }
  private long targetMinutesBetween(UUID employmentId, LocalDate from, LocalDate to) {
    double total = 0;
    for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
      EmploymentTerm term = effectiveTerm(employmentId, date);
      if (term.getTargetMinutes() == null || term.getTargetPeriod() == null) continue;
      total += term.getTargetPeriod() == com.alveryn.api.employment.entity.TargetPeriod.WEEKLY
          ? term.getTargetMinutes() / 7d
          : term.getTargetMinutes() / (double) date.lengthOfMonth();
    }
    return Math.round(total);
  }
  private EmploymentResponse response(Employment e) {
    EmploymentTerm current = terms.findFirstByEmploymentIdOrderByValidFromDesc(e.getId()).orElse(null);
    return new EmploymentResponse(e.getId(), e.getName(), e.getEmploymentType(), e.getCompensationType(),
        e.getTrackingFocus(), e.isHourBalanceEnabled(), e.isTimerEnabled(),
        current == null ? e.getStartDate() : current.getValidFrom(), e.getStartDate(), e.getEndDate(),
        e.getFixedSalaryAmount(), e.getCurrency(), e.getTargetMinutes(), e.getTargetPeriod(), e.getHourBalanceValidityMonths(),
        e.isActive(), e.getDisplayOrder(), isDeletable(e));
  }
}
