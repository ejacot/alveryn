package com.alveryn.api.worksession.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workrecord.dto.*;
import com.alveryn.api.workrecord.service.WorkRecordService;
import com.alveryn.api.worksession.dto.*;
import com.alveryn.api.worksession.entity.WorkSession;
import com.alveryn.api.worksession.repository.WorkSessionRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class WorkSessionService {
  private final WorkSessionRepository sessions;
  private final WorkTypeRepository workTypes;
  private final UserAccountRepository users;
  private final AuthenticatedUserAccessor authenticated;
  private final WorkRecordService workRecords;

  @Transactional(readOnly = true) public WorkSessionResponse current() {
    return sessions.findFirstByUserIdAndCheckedOutAtIsNull(authenticated.requireUserId()).map(this::response).orElse(null);
  }
  @Transactional public WorkSessionResponse checkIn(WorkSessionRequest request) {
    var userId = authenticated.requireUserId();
    if (sessions.findFirstByUserIdAndCheckedOutAtIsNull(userId).isPresent()) throw new ValidationException("An active work session already exists");
    ZoneId.of(request.timezone());
    var workType = workTypes.findByIdAndUserId(request.workTypeId(), userId).orElseThrow(() -> new NotFoundException("WorkType", request.workTypeId()));
    if (!workType.isActive() || workType.getEmployment() == null || !workType.getEmployment().isActive()) throw new ValidationException("Work type and employment must be active");
    if (workType.getCalculationMethod() != CalculationMethod.TIME_BASED) throw new ValidationException("Check-in requires a time-based work type");
    var user = users.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));
    return response(sessions.save(new WorkSession(user, workType.getEmployment(), workType, OffsetDateTime.now(), request.timezone())));
  }
  @Transactional public WorkSessionResponse checkOut(WorkSessionCheckoutRequest request) {
    var session = sessions.findFirstByUserIdAndCheckedOutAtIsNull(authenticated.requireUserId()).orElseThrow(() -> new ValidationException("No active work session"));
    if (request.correctedCheckInAt() != null) session.correctCheckIn(request.correctedCheckInAt());
    OffsetDateTime end = request.correctedCheckOutAt() == null ? OffsetDateTime.now() : request.correctedCheckOutAt();
    if (end.isAfter(OffsetDateTime.now().plusMinutes(1))) throw new ValidationException("check-out cannot be in the future");
    if (session.getPauseStartedAt() != null && end.isBefore(session.getPauseStartedAt())) throw new ValidationException("check-out cannot be before the active pause");
    if (session.getPauseStartedAt() != null) session.endPause(end);
    long elapsed = ChronoUnit.MINUTES.between(session.getCheckedInAt(), end);
    int trackedBreaks = (int) Math.ceil(session.getAccumulatedBreakSeconds() / 60d);
    int defaultBreaks = defaultBreakMinutes(session);
    int breaks = request.breakMinutes() == null
        ? (defaultBreaks > 0 ? defaultBreaks : trackedBreaks)
        : request.breakMinutes();
    if (elapsed <= 0 || elapsed > 24 * 60 || breaks >= elapsed) throw new ValidationException("Work session must be between one minute and 24 hours and longer than its break");
    ZoneId zone = ZoneId.of(session.getTimezone());
    var startLocal = session.getCheckedInAt().atZoneSameInstant(zone);
    var endLocal = end.atZoneSameInstant(zone);
    var line = new WorkRecordLineRequest(session.getWorkType().getId(), null, null, null,
        startLocal.toLocalTime().withSecond(0).withNano(0), endLocal.toLocalTime().withSecond(0).withNano(0),
        null, breaks, null, request.notes());
    var record = workRecords.createSession(new WorkRecordRequest(startLocal.toLocalDate(), endLocal.toLocalDate(), null, null, request.notes(), List.of(line)));
    var persisted = workRecords.requireOwnedEntity(record.id());
    session.complete(end, breaks, request.notes(), persisted);
    return response(session);
  }
  @Transactional public WorkSessionResponse startPause() {
    var session = active();
    if (defaultBreakMinutes(session) > 0) throw new ValidationException("This work type uses a default break");
    session.startPause(OffsetDateTime.now());
    return response(session);
  }
  @Transactional public WorkSessionResponse endPause() {
    var session = active(); session.endPause(OffsetDateTime.now()); return response(session);
  }
  @Transactional public void cancel() { sessions.delete(active()); }
  private WorkSession active() { return sessions.findFirstByUserIdAndCheckedOutAtIsNull(authenticated.requireUserId()).orElseThrow(() -> new ValidationException("No active work session")); }
  private int defaultBreakMinutes(WorkSession session) {
    return session.getWorkType().getDefaultBreakMinutes() == null ? 0 : session.getWorkType().getDefaultBreakMinutes();
  }
  private WorkSessionResponse response(WorkSession s) { return new WorkSessionResponse(s.getId(), s.getEmployment().getId(), s.getEmployment().getName(), s.getWorkType().getId(), s.getWorkType().getName(), defaultBreakMinutes(s), s.getCheckedInAt(), s.getCheckedOutAt(), s.getTimezone(), s.getBreakMinutes(), s.getNotes(), s.getWorkRecord() == null ? null : s.getWorkRecord().getId(), s.getPauseStartedAt(), s.getAccumulatedBreakSeconds(), s.getCheckedOutAt() == null && s.getCheckedInAt().isBefore(OffsetDateTime.now().minusHours(12))); }
}
