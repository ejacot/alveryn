package com.alveryn.api.schedule.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.organization.service.PersonalWorkspaceService;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.entity.*;
import com.alveryn.api.schedule.repository.*;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScheduleService {
  private static final int MATERIALIZATION_WEEKS = 12;
  private final EmploymentService employments;
  private final PersonalWorkspaceService personalWorkspaces;
  private final ScheduleTemplateRepository templates;
  private final ScheduleTemplateRuleRepository rules;
  private final ScheduledShiftRepository shifts;
  private final ShiftBreakRepository breaks;
  private final ShiftAssignmentRepository assignments;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkTypeRepository workTypes;
  private final AbsenceTypeSettingRepository absenceTypes;

  @Transactional(readOnly = true)
  public WeeklyScheduleResponse current(UUID employmentId) {
    Employment employment = employments.requireOwned(employmentId);
    return templates.findFirstByEmploymentIdAndStatusOrderByVersionDesc(
        employment.getId(), ScheduleTemplateStatus.ACTIVE).map(this::response).orElse(null);
  }

  @Transactional
  public WeeklyScheduleResponse replace(UUID employmentId, WeeklyScheduleRequest request) {
    Employment employment = employments.requireOwned(employmentId);
    var workspace = personalWorkspaces.requireOrCreate(employment.getUser());
    if (employment.getOrganization() != null
        && !employment.getOrganization().getId().equals(workspace.organization().getId())) {
      throw new IllegalArgumentException("employment belongs to another workspace");
    }
    ValidatedItems selectedItems = validateRules(employment, request.rules());
    ZoneId zone = ZoneId.of(request.timezone());
    LocalDate today = LocalDate.now(zone);
    if (request.validFrom().isBefore(today)) {
      throw new IllegalArgumentException("validFrom cannot be in the past");
    }
    if (request.validTo() != null && request.validTo().isBefore(request.validFrom())) {
      throw new IllegalArgumentException("validTo cannot be before validFrom");
    }

    ScheduleTemplate previous = templates.findFirstByEmploymentIdAndStatusOrderByVersionDesc(
        employmentId, ScheduleTemplateStatus.ACTIVE).orElse(null);
    int version = templates.findFirstByEmploymentIdOrderByVersionDesc(employmentId)
        .map(value -> value.getVersion() + 1).orElse(1);
    if (previous != null) previous.endBefore(request.validFrom());

    ScheduleTemplate template = templates.save(new ScheduleTemplate(workspace.organization(), employment,
        request.name(), request.timezone(), request.validFrom(), request.validTo(), version, workspace.membership()));
    List<ScheduleTemplateRule> savedRules = request.rules().stream()
        .map(rule -> rule.itemType() == ScheduleItemType.ACTIVITY
            ? new ScheduleTemplateRule(template, selectedItems.workTypes().get(rule.workTypeId()),
                rule.dayOfWeek(), rule.startTime(), rule.endTime(), rule.breakMinutes())
            : new ScheduleTemplateRule(template, selectedItems.absenceTypes().get(rule.absenceTypeId()),
                rule.dayOfWeek(), rule.startTime(), rule.endTime()))
        .map(rules::save)
        .toList();

    OffsetDateTime deleteFrom = request.validFrom().atStartOfDay(zone).toOffsetDateTime();
    shifts.deleteGeneratedFuture(employmentId, deleteFrom);
    LocalDate materializeTo = request.validFrom().plusWeeks(MATERIALIZATION_WEEKS).minusDays(1);
    if (request.validTo() != null && request.validTo().isBefore(materializeTo)) materializeTo = request.validTo();
    materialize(template, savedRules, employment, workspace.membership(), request.validFrom(), materializeTo);
    return response(template);
  }

  @Transactional
  public List<ScheduledShiftResponse> range(UUID employmentId, LocalDate from, LocalDate to) {
    Employment employment = employments.requireOwned(employmentId);
    if (to.isBefore(from)) throw new IllegalArgumentException("to must be on or after from");
    ScheduleTemplate activeTemplate = templates.findFirstByEmploymentIdAndStatusOrderByVersionDesc(
        employmentId, ScheduleTemplateStatus.ACTIVE).orElse(null);
    String timezone = activeTemplate == null ? "UTC" : activeTemplate.getTimezone();
    if (activeTemplate != null && !to.isBefore(activeTemplate.getValidFrom())) {
      LocalDate materializeFrom = from.isAfter(activeTemplate.getValidFrom()) ? from : activeTemplate.getValidFrom();
      LocalDate materializeTo = activeTemplate.getValidTo() != null && activeTemplate.getValidTo().isBefore(to)
          ? activeTemplate.getValidTo() : to;
      if (!materializeTo.isBefore(materializeFrom)) {
        materialize(activeTemplate, rules.findAllByTemplateIdOrderByDayOfWeekAscStartLocalTimeAsc(activeTemplate.getId()),
            employment, activeTemplate.getCreatedBy(), materializeFrom, materializeTo);
      }
    }
    ZoneId zone = ZoneId.of(timezone);
    return assignments.findRange(employment.getId(), from.atStartOfDay(zone).toOffsetDateTime(),
            to.plusDays(1).atStartOfDay(zone).toOffsetDateTime()).stream()
        .map(value -> shiftResponse(employmentId, value)).toList();
  }

  @Transactional
  public ScheduledShiftResponse override(UUID employmentId, UUID assignmentId, ShiftOverrideRequest request) {
    Employment employment = employments.requireOwned(employmentId);
    ShiftAssignment assignment = assignments.findOwned(assignmentId, authenticatedUserAccessor.requireUserId())
        .orElseThrow(() -> new NotFoundException("ShiftAssignment", assignmentId));
    if (!assignment.getEmployment().getId().equals(employment.getId())) {
      throw new NotFoundException("ShiftAssignment", assignmentId);
    }
    ScheduledShift shift = assignment.getShift();
    ZoneId zone = ZoneId.of(shift.getTimezone());
    ZonedDateTime start = ZonedDateTime.of(request.date(), request.startTime(), zone);
    ZonedDateTime end = ZonedDateTime.of(request.date(), request.endTime(), zone);
    shift.override(start.toOffsetDateTime(), end.toOffsetDateTime());
    return shiftResponse(employmentId, assignment);
  }

  private void materialize(ScheduleTemplate template, List<ScheduleTemplateRule> scheduleRules,
      Employment employment, com.alveryn.api.organization.entity.OrganizationMembership membership,
      LocalDate from, LocalDate to) {
    ZoneId zone = ZoneId.of(template.getTimezone());
    for (ScheduleTemplateRule rule : scheduleRules) {
      LocalDate date = from.with(TemporalAdjusters.nextOrSame(rule.day()));
      while (!date.isAfter(to)) {
        ZonedDateTime start = ZonedDateTime.of(date, rule.getStartLocalTime(), zone);
        ZonedDateTime end = ZonedDateTime.of(date, rule.getEndLocalTime(), zone);
        if (shifts.existsByTemplateRuleIdAndTemplateOccurrenceDate(rule.getId(), date)) {
          date = date.plusWeeks(1);
          continue;
        }
        ScheduledShift shift = shifts.save(new ScheduledShift(template.getOrganization(), rule,
            start.toOffsetDateTime(), end.toOffsetDateTime(), template.getTimezone(), membership));
        if (rule.getBreakMinutes() > 0) breaks.save(new ShiftBreak(shift, rule.getBreakMinutes(), false));
        assignments.save(new ShiftAssignment(shift, employment, membership, membership));
        date = date.plusWeeks(1);
      }
    }
  }

  private ValidatedItems validateRules(Employment employment, List<ScheduleRuleRequest> requested) {
    Map<UUID, WorkType> selected = new HashMap<>();
    Map<UUID, AbsenceTypeSetting> selectedAbsences = new HashMap<>();
    for (ScheduleRuleRequest rule : requested) {
      if (rule.itemType() == ScheduleItemType.ACTIVITY) {
        if (rule.workTypeId() == null || rule.absenceTypeId() != null)
          throw new IllegalArgumentException("activity requires a work type");
        WorkType workType = workTypes.findByIdAndUserId(rule.workTypeId(), employment.getUser().getId())
            .orElseThrow(() -> new NotFoundException("WorkType", rule.workTypeId()));
        if (!workType.isActive() || workType.getEmployment() == null
            || !workType.getEmployment().getId().equals(employment.getId())) {
          throw new IllegalArgumentException("work type must be active and belong to the employment");
        }
        selected.put(workType.getId(), workType);
      } else {
        if (rule.absenceTypeId() == null || rule.workTypeId() != null)
          throw new IllegalArgumentException("absence requires an absence type");
        AbsenceTypeSetting absenceType = absenceTypes
            .findByIdAndUserId(rule.absenceTypeId(), employment.getUser().getId())
            .orElseThrow(() -> new NotFoundException("AbsenceType", rule.absenceTypeId()));
        if (!absenceType.isActive()) throw new IllegalArgumentException("absence type must be active");
        selectedAbsences.put(absenceType.getId(), absenceType);
      }
      long duration = Duration.between(rule.startTime(), rule.endTime()).toMinutes();
      if (duration <= 0) throw new IllegalArgumentException("end time must be after start time");
      if (rule.breakMinutes() >= duration) throw new IllegalArgumentException("break must fit inside shift");
    }
    requested.stream().collect(java.util.stream.Collectors.groupingBy(ScheduleRuleRequest::dayOfWeek))
        .values().forEach(dayRules -> {
          List<ScheduleRuleRequest> ordered = dayRules.stream()
              .sorted(Comparator.comparing(ScheduleRuleRequest::startTime)).toList();
          for (int index = 1; index < ordered.size(); index++) {
            if (ordered.get(index).startTime().isBefore(ordered.get(index - 1).endTime())) {
              throw new IllegalArgumentException("planned activities cannot overlap");
            }
          }
        });
    return new ValidatedItems(selected, selectedAbsences);
  }

  private WeeklyScheduleResponse response(ScheduleTemplate template) {
    List<ScheduleRuleResponse> scheduleRules = rules.findAllByTemplateIdOrderByDayOfWeekAscStartLocalTimeAsc(template.getId())
        .stream().map(rule -> new ScheduleRuleResponse(rule.getId(), rule.getItemType(),
            rule.getWorkType() == null ? null : rule.getWorkType().getId(),
            rule.getWorkTypeNameSnapshot(), rule.getWorkTypeColorSnapshot(),
            rule.getAbsenceType() == null ? null : rule.getAbsenceType().getId(),
            rule.getAbsenceTypeNameSnapshot(), rule.getAbsenceTypeColorSnapshot(), rule.day(),
            rule.getStartLocalTime(), rule.getEndLocalTime(), rule.getBreakMinutes())).toList();
    return new WeeklyScheduleResponse(template.getId(), template.getEmployment().getId(), template.getName(),
        template.getTimezone(), template.getValidFrom(), template.getValidTo(), template.getVersion(), scheduleRules);
  }

  private ScheduledShiftResponse shiftResponse(UUID employmentId, ShiftAssignment assignment) {
    ScheduledShift shift = assignment.getShift();
    int breakMinutes = shift.getTemplateRule() == null ? 0 : shift.getTemplateRule().getBreakMinutes();
    return new ScheduledShiftResponse(shift.getId(), assignment.getId(), employmentId, shift.getItemType(),
        shift.getWorkType() == null ? null : shift.getWorkType().getId(),
        shift.getWorkTypeNameSnapshot(), shift.getWorkTypeColorSnapshot(),
        shift.getAbsenceType() == null ? null : shift.getAbsenceType().getId(),
        shift.getAbsenceTypeNameSnapshot(), shift.getAbsenceTypeColorSnapshot(),
        shift.getStartsAt(), shift.getEndsAt(), shift.getTimezone(), breakMinutes,
        shift.getStatus(), assignment.getStatus(), shift.getSource());
  }

  private record ValidatedItems(Map<UUID, WorkType> workTypes,
      Map<UUID, AbsenceTypeSetting> absenceTypes) {}
}
