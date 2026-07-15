package com.alveryn.api.workentry.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.workentry.dto.WorkEntryRequest;
import com.alveryn.api.workentry.dto.WorkEntryResponse;
import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.workentry.repository.TimeEntryDetailsRepository;
import com.alveryn.api.workentry.repository.UnitEntryItemRepository;
import com.alveryn.api.workentry.repository.WorkEntryRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
  private final WorkEntryCalculationService calculationService;
  private final WorkEntryValidationService validationService;
  private final WorkEntryTimeOverlapService timeOverlapService;
  private final WorkEntryQueryService queryService;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

  @PersistenceContext private EntityManager entityManager;

  @Transactional
  public WorkEntryResponse create(@Valid WorkEntryRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkType workType = queryService.findWorkType(userId, request.workTypeId());
    validationService.validateForPersistence(userId, workType, request);

    WorkEntryCalculationService.PreparedWorkEntry prepared =
        calculationService.prepareEntry(userId, workType, request);
    lockTimeScheduleIfNeeded(userId, workType);
    validateTimeOverlap(userId, null, workType, request, prepared);
    WorkEntry saved =
        workEntries.save(
            new WorkEntry(
                workType.getUser(),
                workType,
                request.workDate(),
                prepared.salary().hourlyRate(),
                prepared.salary().currency(),
                prepared.calculatedMinutes()));
    saved.updateNotes(request.notes());
    calculationService.persistDetails(timeEntryDetails, unitEntryItems, saved, prepared);
    return queryService.toResponse(saved);
  }

  @Transactional(readOnly = true)
  public Page<WorkEntryResponse> list(Integer year, Integer month, UUID workTypeId, Pageable pageable) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkEntryValidationService.DateRange range = validationService.resolveRange(year, month);
    return queryService.list(userId, range.fromDate(), range.toDate(), workTypeId, pageable);
  }

  @Transactional(readOnly = true)
  public List<WorkEntryResponse> listDay(LocalDate date) {
    return queryService.listDay(authenticatedUserAccessor.requireUserId(), date);
  }

  @Transactional(readOnly = true)
  public List<WorkEntryResponse> listRecent(int limit) {
    return queryService.listRecent(authenticatedUserAccessor.requireUserId(), limit);
  }

  @Transactional(readOnly = true)
  public WorkEntryResponse get(UUID id) {
    return queryService.getResponse(authenticatedUserAccessor.requireUserId(), id);
  }

  @Transactional
  public WorkEntryResponse update(UUID id, @Valid WorkEntryRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkEntry entry = queryService.findEntry(userId, id);
    WorkType workType = queryService.findWorkType(userId, request.workTypeId());
    validationService.validateForPersistence(userId, workType, request);

    WorkEntryCalculationService.PreparedWorkEntry prepared =
        calculationService.prepareEntry(userId, workType, request);
    lockTimeScheduleIfNeeded(userId, workType);
    validateTimeOverlap(userId, id, workType, request, prepared);
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
    calculationService.persistDetails(timeEntryDetails, unitEntryItems, entry, prepared);
    return queryService.toResponse(entry);
  }

  @Transactional
  public void delete(UUID id) {
    workEntries.delete(queryService.findEntry(authenticatedUserAccessor.requireUserId(), id));
  }

  private void validateTimeOverlap(
      UUID userId,
      UUID excludedEntryId,
      WorkType workType,
      WorkEntryRequest request,
      WorkEntryCalculationService.PreparedWorkEntry prepared) {
    if (workType.getCalculationMethod() != CalculationMethod.TIME_BASED) {
      return;
    }
    timeOverlapService.validateNoOverlap(
        userId, excludedEntryId, request.workDate(), prepared.startTime(), prepared.endTime());
  }

  private void lockTimeScheduleIfNeeded(UUID userId, WorkType workType) {
    if (workType.getCalculationMethod() != CalculationMethod.TIME_BASED) {
      return;
    }
    entityManager
        .createNativeQuery("select pg_advisory_xact_lock(hashtextextended(:lockKey, 0))")
        .setParameter("lockKey", "work-entry-time:" + userId)
        .getSingleResult();
  }
}
