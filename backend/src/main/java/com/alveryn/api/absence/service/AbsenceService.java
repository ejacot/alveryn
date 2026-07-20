package com.alveryn.api.absence.service;

import com.alveryn.api.absence.dto.AbsenceRequest;
import com.alveryn.api.absence.dto.AbsenceResponse;
import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.Month;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class AbsenceService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final AbsenceRepository absences;
  private final AbsenceTypeSettingRepository absenceTypes;
  private final UserAccountRepository users;
  private final WorkRecordRepository workRecords;
  private final EmploymentService employments;

  @Transactional
  public AbsenceResponse create(@Valid AbsenceRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    Employment employment = employments.requireOwned(request.employmentId());
    validateRange(request.startDate(), request.endDate());
    ensureNoAbsenceOverlap(userId, employment.getId(), request.startDate(), request.endDate(), null);
    ensureNoWorkRecordOverlap(userId, employment.getId(), request.startDate(), request.endDate());
    AbsenceTypeSetting type = resolveType(userId, request);
    Absence absence =
        new Absence(
            users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId)),
            employment,
            type,
            request.startDate(),
            request.endDate());
    absence.updateNotes(InputSanitizer.trimToNull(request.notes()));
    return toResponse(absences.save(absence));
  }

  @Transactional
  public Page<AbsenceResponse> list(
      Integer year,
      Integer month,
      LocalDate from,
      LocalDate to,
      UUID absenceTypeId,
      AbsenceType absenceType,
      UUID employmentId,
      Pageable pageable) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    DateRange range = resolveRange(year, month, from, to);
    return absences
        .findAll(specification(userId, range, absenceTypeId, absenceType, employmentId), pageable)
        .map(this::toResponse);
  }

  @Transactional(readOnly = true)
  public AbsenceResponse get(UUID id) {
    return toResponse(findCurrentUserAbsence(id));
  }

  @Transactional
  public AbsenceResponse update(UUID id, @Valid AbsenceRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    Absence absence = findCurrentUserAbsence(id);
    Employment employment = employments.requireOwned(request.employmentId());
    if (!absence.getEmployment().getId().equals(employment.getId())) {
      throw new ValidationException("An absence cannot be moved to another employment");
    }
    validateRange(request.startDate(), request.endDate());
    ensureNoAbsenceOverlap(userId, employment.getId(), request.startDate(), request.endDate(), id);
    ensureNoWorkRecordOverlap(userId, employment.getId(), request.startDate(), request.endDate());
    AbsenceTypeSetting type = resolveType(userId, request);
    absence.update(
        type,
        request.startDate(),
        request.endDate(),
        InputSanitizer.trimToNull(request.notes()));
    return toResponse(absence);
  }

  @Transactional
  public void delete(UUID id) {
    absences.delete(findCurrentUserAbsence(id));
  }

  private Absence findCurrentUserAbsence(UUID id) {
    return absences
        .findByIdAndUserId(id, authenticatedUserAccessor.requireUserId())
        .orElseThrow(() -> new NotFoundException("Absence", id));
  }

  private void ensureNoAbsenceOverlap(UUID userId, UUID employmentId, LocalDate startDate, LocalDate endDate, UUID excludedId) {
    boolean overlaps =
        excludedId == null
            ? absences.existsByUserIdAndEmploymentIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                userId, employmentId, endDate, startDate)
            : absences.existsByUserIdAndEmploymentIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualAndIdNot(
                userId, employmentId, endDate, startDate, excludedId);
    if (overlaps) {
      throw new ConflictException("Absence ranges cannot overlap");
    }
  }

  private void ensureNoWorkRecordOverlap(UUID userId, UUID employmentId, LocalDate startDate, LocalDate endDate) {
    if (workRecords.existsByUserIdAndEmploymentIdAndWorkDateBetween(userId, employmentId, startDate, endDate)) {
      throw new ConflictException("Absence range overlaps existing work records");
    }
  }

  private void validateRange(LocalDate startDate, LocalDate endDate) {
    if (startDate == null || endDate == null) {
      throw new ValidationException("startDate and endDate are required");
    }
    if (endDate.isBefore(startDate)) {
      throw new ValidationException("endDate cannot be before startDate");
    }
  }

  private DateRange resolveRange(Integer year, Integer month, LocalDate from, LocalDate to) {
    if (month != null && year == null) {
      throw new ValidationException("month requires year");
    }
    if (from != null && to != null && from.isAfter(to)) {
      throw new ValidationException("from cannot be after to");
    }
    if ((year != null || month != null) && (from != null || to != null)) {
      throw new ValidationException("year/month filters cannot be combined with from/to filters");
    }
    if (year == null) {
      return new DateRange(from, to);
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
    LocalDate start = LocalDate.of(year, resolvedMonth, 1);
    return new DateRange(start, start.withDayOfMonth(start.lengthOfMonth()));
  }

  private AbsenceTypeSetting resolveType(UUID userId, AbsenceRequest request) {
    if (request.absenceTypeId() != null) {
      return absenceTypes
          .findByIdAndUserId(request.absenceTypeId(), userId)
          .filter(AbsenceTypeSetting::isActive)
          .orElseThrow(() -> new NotFoundException("AbsenceType", request.absenceTypeId()));
    }
    AbsenceType legacyType = request.absenceType() == null ? AbsenceType.DAY_OFF : request.absenceType();
    return absenceTypes
        .findByUserIdAndCode(userId, legacyType)
        .orElseThrow(() -> new NotFoundException("AbsenceType", legacyType.name()));
  }

  private Specification<Absence> specification(
      UUID userId, DateRange range, UUID absenceTypeId, AbsenceType absenceType, UUID employmentId) {
    return (root, query, builder) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(builder.equal(root.get("user").get("id"), userId));
      if (employmentId != null) {
        predicates.add(builder.equal(root.get("employment").get("id"), employmentId));
      }
      if (absenceTypeId != null) {
        predicates.add(builder.equal(root.get("absenceTypeSetting").get("id"), absenceTypeId));
      }
      if (absenceType != null) {
        predicates.add(builder.equal(root.get("absenceType"), absenceType));
      }
      if (range.from() != null) {
        predicates.add(builder.greaterThanOrEqualTo(root.get("endDate"), range.from()));
      }
      if (range.to() != null) {
        predicates.add(builder.lessThanOrEqualTo(root.get("startDate"), range.to()));
      }
      return builder.and(predicates.toArray(Predicate[]::new));
    };
  }

  private AbsenceResponse toResponse(Absence absence) {
    return new AbsenceResponse(
        absence.getId(),
        absence.getEmployment().getId(),
        absence.getEmployment().getName(),
        absence.getAbsenceTypeSetting() == null ? null : absence.getAbsenceTypeSetting().getId(),
        absence.getAbsenceType(),
        absence.getAbsenceTypeNameSnapshot(),
        absence.isPaidSnapshot(),
        absence.getPaidMinutesPerDaySnapshot(),
        absence.getStartDate(),
        absence.getEndDate(),
        absence.getNotes());
  }
  private record DateRange(LocalDate from, LocalDate to) {}
}
