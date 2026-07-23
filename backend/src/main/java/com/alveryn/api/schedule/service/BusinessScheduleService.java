package com.alveryn.api.schedule.service;

import com.alveryn.api.common.exception.*;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.service.*;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.entity.*;
import com.alveryn.api.schedule.repository.*;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class BusinessScheduleService {
  private final OrganizationAccessService access;
  private final OrganizationActivityService activities;
  private final OrganizationMembershipRepository memberships;
  private final EmploymentRepository employments;
  private final ScheduledShiftRepository shifts;
  private final ShiftAssignmentRepository assignments;
  private final ShiftBreakRepository breaks;
  private final WorkRecordLineRepository workLines;

  @Transactional
  public BusinessShiftResponse create(UUID organizationId, BusinessShiftRequest request) {
    var manager = access.requireManager(organizationId);
    var worker = memberships.findById(request.membershipId())
        .filter(value -> value.getOrganization().getId().equals(organizationId))
        .filter(value -> value.getStatus() == MembershipStatus.ACTIVE)
        .orElseThrow(() -> new NotFoundException("Membership", request.membershipId()));
    var employment = employments.findById(request.employmentId())
        .filter(value -> value.getOrganization() != null && value.getOrganization().getId().equals(organizationId))
        .filter(value -> value.getUser().getId().equals(worker.getUser().getId()))
        .filter(com.alveryn.api.employment.entity.Employment::isActive)
        .orElseThrow(() -> new NotFoundException("Employment", request.employmentId()));
    var activity = activities.requireActive(organizationId, request.activityId());
    ZoneId zone = ZoneId.of(manager.getOrganization().getTimezone());
    var start = ZonedDateTime.of(request.date(), request.startTime(), zone).toOffsetDateTime();
    var end = ZonedDateTime.of(request.date(), request.endTime(), zone).toOffsetDateTime();
    if (!end.isAfter(start)) throw new IllegalArgumentException("endTime must be after startTime");
    if (assignments.hasOverlap(worker.getId(), start, end))
      throw new ConflictException("Employee already has an overlapping shift");
    int pause = Objects.requireNonNullElse(request.breakMinutes(), activity.getDefaultBreakMinutes());
    if (pause >= Duration.between(start, end).toMinutes())
      throw new IllegalArgumentException("break must fit inside shift");
    var shift = shifts.save(new ScheduledShift(manager.getOrganization(), activity, start, end,
        manager.getOrganization().getTimezone(), manager));
    if (pause > 0) breaks.save(new ShiftBreak(shift, pause, false));
    return response(assignments.save(new ShiftAssignment(shift, employment, worker, manager)));
  }

  @Transactional(readOnly=true)
  public List<BusinessShiftResponse> range(UUID organizationId, LocalDate from, LocalDate to) {
    var member = access.requireMember(organizationId);
    if (to.isBefore(from)) throw new IllegalArgumentException("to must be on or after from");
    ZoneId zone = ZoneId.of(member.getOrganization().getTimezone());
    var values = assignments.findOrganizationRange(organizationId,
        from.atStartOfDay(zone).toOffsetDateTime(), to.plusDays(1).atStartOfDay(zone).toOffsetDateTime());
    if (member.getRole() == MembershipRole.EMPLOYEE)
      values = values.stream().filter(value -> value.getWorker().getId().equals(member.getId())).toList();
    return values.stream().map(this::response).toList();
  }

  @Transactional
  public BusinessShiftResponse update(UUID organizationId, UUID assignmentId, BusinessShiftRequest request) {
    access.requireManager(organizationId);
    var existing = assignments.findByIdAndOrganizationId(assignmentId, organizationId)
        .orElseThrow(() -> new NotFoundException("ShiftAssignment", assignmentId));
    if (!existing.getWorker().getId().equals(request.membershipId())
        || !existing.getEmployment().getId().equals(request.employmentId())
        || existing.getShift().getOrganizationActivity() == null
        || !existing.getShift().getOrganizationActivity().getId().equals(request.activityId()))
      throw new IllegalArgumentException("changing employee, employment or activity requires a new shift");
    ZoneId zone = ZoneId.of(existing.getShift().getTimezone());
    var start = ZonedDateTime.of(request.date(), request.startTime(), zone).toOffsetDateTime();
    var end = ZonedDateTime.of(request.date(), request.endTime(), zone).toOffsetDateTime();
    if (!end.isAfter(start)) throw new IllegalArgumentException("endTime must be after startTime");
    if (assignments.hasOverlapExcluding(existing.getWorker().getId(), assignmentId, start, end))
      throw new ConflictException("Employee already has an overlapping shift");
    int pause = Objects.requireNonNullElse(request.breakMinutes(),
        existing.getShift().getOrganizationActivity().getDefaultBreakMinutes());
    if (pause >= Duration.between(start, end).toMinutes())
      throw new IllegalArgumentException("break must fit inside shift");
    existing.getShift().override(start, end);
    var shiftBreak = breaks.findFirstByShiftId(existing.getShift().getId()).orElse(null);
    if (shiftBreak == null && pause > 0) breaks.save(new ShiftBreak(existing.getShift(), pause, false));
    else if (shiftBreak != null) shiftBreak.changePlannedMinutes(pause);
    return response(existing);
  }

  @Transactional
  public void cancel(UUID organizationId, UUID assignmentId) {
    access.requireManager(organizationId);
    assignments.findByIdAndOrganizationId(assignmentId, organizationId)
        .orElseThrow(() -> new NotFoundException("ShiftAssignment", assignmentId)).getShift().cancel();
  }

  BusinessShiftResponse response(ShiftAssignment assignment) {
    var shift = assignment.getShift();
    int pause = breaks.findFirstByShiftId(shift.getId()).map(ShiftBreak::getPlannedMinutes).orElse(0);
    long planned = Math.max(0, Duration.between(shift.getStartsAt(), shift.getEndsAt()).toMinutes() - pause);
    long worked = workLines.sumWorkedMinutesByAssignmentId(assignment.getId()).longValue();
    var activity = shift.getOrganizationActivity();
    return new BusinessShiftResponse(shift.getId(), assignment.getId(), assignment.getWorker().getId(),
        assignment.getWorker().getUser().getEmail(), assignment.getEmployment().getId(),
        assignment.getEmployment().getName(), activity == null ? null : activity.getId(),
        activity == null ? shift.getWorkTypeNameSnapshot() : shift.getActivityNameSnapshot(),
        activity == null ? shift.getWorkTypeColorSnapshot() : shift.getActivityColorSnapshot(),
        shift.getStartsAt(), shift.getEndsAt(), pause, shift.getStatus(), assignment.getStatus(), planned, worked);
  }
}
