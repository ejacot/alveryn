package com.alveryn.api.staffing.service;

import static com.alveryn.api.staffing.dto.StaffingDtos.*;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.staffing.entity.StaffingAssignment;
import com.alveryn.api.staffing.entity.StaffingAssignmentResult;
import com.alveryn.api.staffing.repository.StaffingAssignmentRepository;
import com.alveryn.api.staffing.repository.StaffingAssignmentResultRepository;
import com.alveryn.api.staffing.repository.StaffingMemberDayEntryRepository;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads employee planning only from an immutable latest version, with a bounded legacy fallback. */
@Service
@RequiredArgsConstructor
public class StaffingPublishedScheduleService {
  private final AuthenticatedUserAccessor currentUser;
  private final OrganizationMembershipRepository memberships;
  private final StaffingAssignmentRepository assignments;
  private final StaffingAssignmentResultRepository results;
  private final StaffingMemberDayEntryRepository dayEntries;
  private final NamedParameterJdbcTemplate jdbc;

  @Transactional(readOnly = true)
  public List<PersonalScheduleResponse> schedule(LocalDate from, LocalDate to) {
    if (to.isBefore(from) || to.isAfter(from.plusDays(31))) {
      throw new IllegalArgumentException("invalid planner range");
    }
    UUID userId = currentUser.requireUserId();
    return memberships.findAllByUserIdAndStatusOrderByCreatedAtAsc(userId, MembershipStatus.ACTIVE)
        .stream().filter(member -> member.getOrganization().getOrganizationType()
            == OrganizationType.BUSINESS)
        .map(member -> schedule(member, from, to)).toList();
  }

  @Transactional(readOnly = true)
  public boolean isCurrentPublishedAssignment(UUID userId, UUID assignmentId) {
    Boolean visible = jdbc.queryForObject("""
        select exists(
          select 1 from staffing_plan_version_assignments va
          join staffing_plan_versions v on v.id=va.version_id
          join staffing_plans p on p.latest_published_version_id=v.id
          join organization_memberships m on m.id=va.organization_membership_id
          where va.source_assignment_id=:assignment and va.assignment_status='ASSIGNED'
            and m.user_id=:user and m.membership_status='ACTIVE'
          union all
          select 1 from staffing_assignments a
          join staffing_requirements r on r.id=a.requirement_id
          join staffing_plan_days d on d.id=r.plan_day_id
          join staffing_plans p on p.id=d.plan_id
          join organization_memberships m on m.id=a.membership_id
          where a.id=:assignment and a.assignment_status='ASSIGNED'
            and r.publication_status='PUBLISHED' and p.latest_published_version_id is null
            and m.user_id=:user and m.membership_status='ACTIVE'
        )
        """, params("assignment", assignmentId, "user", userId), Boolean.class);
    return Boolean.TRUE.equals(visible);
  }

  private PersonalScheduleResponse schedule(OrganizationMembership member, LocalDate from,
      LocalDate to) {
    UUID organizationId = member.getOrganization().getId();
    UUID membershipId = member.getId();
    MapSqlParameterSource scope = params("organization", organizationId, "member", membershipId,
        "from", from, "to", to);

    List<VersionRow> versionRows = jdbc.query("""
        select distinct p.id plan_id,p.unit_id,v.id version_id,v.version_number,v.published_at,
          v.week_start
        from staffing_plans p join staffing_plan_versions v on v.id=p.latest_published_version_id
        where p.organization_id=:organization and v.week_start<=:to
          and v.week_start+6>=:from and (
            exists(select 1 from staffing_plan_version_assignments va where va.version_id=v.id
              and va.organization_membership_id=:member and va.assignment_status='ASSIGNED'
              and va.work_date between :from and :to)
            or exists(select 1 from staffing_plan_version_member_days md where md.version_id=v.id
              and md.organization_membership_id=:member and md.work_date between :from and :to))
        order by v.week_start,p.unit_id
        """, scope, (rs, row) -> new VersionRow(rs.getObject("plan_id", UUID.class),
        rs.getObject("unit_id", UUID.class), rs.getObject("version_id", UUID.class),
        rs.getInt("version_number"), rs.getObject("published_at", OffsetDateTime.class),
        rs.getObject("week_start", LocalDate.class)));

    List<SnapshotAssignment> snapshotAssignments = jdbc.query("""
        select va.version_id,va.source_assignment_id,va.work_date,va.unit_id,va.unit_name,
          va.work_type_id,va.work_type_code,va.work_type_name,va.start_time,va.end_time,
          va.check_in_mode
        from staffing_plans p join staffing_plan_versions v on v.id=p.latest_published_version_id
        join staffing_plan_version_assignments va on va.version_id=v.id
        where p.organization_id=:organization and va.organization_membership_id=:member
          and va.assignment_status='ASSIGNED' and va.work_date between :from and :to
        order by va.work_date,va.start_time nulls first,va.source_assignment_id
        """, scope, (rs, row) -> new SnapshotAssignment(
        rs.getObject("version_id", UUID.class), rs.getObject("source_assignment_id", UUID.class),
        rs.getObject("work_date", LocalDate.class), rs.getObject("unit_id", UUID.class),
        rs.getString("unit_name"), rs.getObject("work_type_id", UUID.class),
        rs.getString("work_type_code"), rs.getString("work_type_name"),
        rs.getObject("start_time", LocalTime.class), rs.getObject("end_time", LocalTime.class),
        rs.getString("check_in_mode")));

    List<SnapshotDay> snapshotDays = jdbc.query("""
        select md.version_id,md.source_day_entry_id,md.work_date,md.status,md.notes
        from staffing_plans p join staffing_plan_versions v on v.id=p.latest_published_version_id
        join staffing_plan_version_member_days md on md.version_id=v.id
        where p.organization_id=:organization and md.organization_membership_id=:member
          and md.work_date between :from and :to
        order by md.work_date,md.source_day_entry_id
        """, scope, (rs, row) -> new SnapshotDay(rs.getObject("version_id", UUID.class),
        rs.getObject("source_day_entry_id", UUID.class), rs.getObject("work_date", LocalDate.class),
        rs.getString("status"), rs.getString("notes")));

    List<StaffingAssignment> legacyAssignments = assignments
        .findPublishedForMembership(membershipId, from, to).stream()
        .filter(value -> value.getRequirement().getPlanDay() != null
            && value.getRequirement().getPlanDay().getPlan().getLatestPublishedVersion() == null)
        .toList();
    Set<LocalDate> versionedWeeks = versionedWeeks(organizationId, from, to);
    var legacyDays = dayEntries.findAllByOrganizationIdAndMembershipIdAndDateBetweenOrderByDateAsc(
        organizationId, membershipId, from, to).stream()
        .filter(value -> !versionedWeeks.contains(weekStart(value.getDate()))).toList();

    Set<UUID> sourceAssignmentIds = new LinkedHashSet<>();
    snapshotAssignments.forEach(value -> sourceAssignmentIds.add(value.assignmentId));
    legacyAssignments.forEach(value -> sourceAssignmentIds.add(value.getId()));
    Map<UUID, StaffingAssignmentResult> resultByAssignment = sourceAssignmentIds.isEmpty()
        ? Map.of() : results.findAllForAssignments(sourceAssignmentIds).stream().collect(
            Collectors.toMap(value -> value.getAssignment().getId(), Function.identity()));

    List<PersonalAssignmentResponse> personalAssignments = new ArrayList<>();
    snapshotAssignments.forEach(value -> personalAssignments.add(new PersonalAssignmentResponse(
        value.assignmentId, value.versionId, value.date, value.unitId, value.unitName,
        value.workTypeId, value.workTypeCode, value.workTypeName, null, value.start, value.end,
        value.checkInMode, result(value.assignmentId, resultByAssignment))));
    legacyAssignments.forEach(value -> personalAssignments.add(legacy(value, resultByAssignment)));
    personalAssignments.sort(Comparator.comparing(PersonalAssignmentResponse::date)
        .thenComparing(value -> value.startTime() == null ? LocalTime.MIN : value.startTime())
        .thenComparing(PersonalAssignmentResponse::id));

    Set<LocalDate> assignmentDates = personalAssignments.stream()
        .map(PersonalAssignmentResponse::date).collect(Collectors.toSet());
    List<PersonalDayEntryResponse> personalDays = new ArrayList<>();
    snapshotDays.forEach(value -> personalDays.add(new PersonalDayEntryResponse(value.entryId,
        value.versionId, value.date, value.status, value.notes, assignmentDates.contains(value.date))));
    legacyDays.forEach(value -> personalDays.add(new PersonalDayEntryResponse(value.getId(), null,
        value.getDate(), value.getType(), value.getNotes(), assignmentDates.contains(value.getDate()))));
    personalDays.sort(Comparator.comparing(PersonalDayEntryResponse::date)
        .thenComparing(PersonalDayEntryResponse::id));

    List<PersonalPublishedVersionResponse> publishedVersions = versionRows.stream()
        .map(value -> new PersonalPublishedVersionResponse(value.planId, value.unitId,
            value.versionId, value.versionNumber, value.publishedAt, value.weekStart)).toList();
    return new PersonalScheduleResponse(organizationId, member.getOrganization().getName(), from,
        to, publishedVersions, List.copyOf(personalAssignments), List.copyOf(personalDays));
  }

  private Set<LocalDate> versionedWeeks(UUID organizationId, LocalDate from, LocalDate to) {
    return new LinkedHashSet<>(jdbc.query("""
        select distinct week_start from staffing_plans
        where organization_id=:organization and latest_published_version_id is not null
          and week_start<=:to and week_start+6>=:from
        """, params("organization", organizationId, "from", from, "to", to),
        (rs, row) -> rs.getObject("week_start", LocalDate.class)));
  }

  private PersonalAssignmentResponse legacy(StaffingAssignment value,
      Map<UUID, StaffingAssignmentResult> resultByAssignment) {
    var requirement = value.getRequirement();
    LocalTime start = value.getStartTime() == null ? requirement.getStartTime() : value.getStartTime();
    LocalTime end = value.getEndTime() == null ? requirement.getEndTime() : value.getEndTime();
    return new PersonalAssignmentResponse(value.getId(), null, requirement.getDate(),
        requirement.getUnit().getId(), requirement.getUnit().getName(),
        requirement.getWorkType().getId(), requirement.getWorkType().getCode(),
        requirement.getWorkType().getName(), requirement.getWorkType().getColor(), start, end,
        requirement.getUnit().getCheckInMode().name(), result(value.getId(), resultByAssignment));
  }

  private PersonalAssignmentResultResponse result(UUID assignmentId,
      Map<UUID, StaffingAssignmentResult> values) {
    StaffingAssignmentResult value = values.get(assignmentId);
    if (value == null) return null;
    return new PersonalAssignmentResultResponse(value.getId(), value.getActualStartTime(),
        value.getActualEndTime(), value.getBreakMinutes(), value.getCompletedQuantity(),
        calculatedMinutes(value), value.getNotes(), value.getApprovalStatus(), value.getSubmittedAt(),
        value.getReviewedAt(), value.getCheckedInAt(), value.getCheckedOutAt(),
        value.getTimeCaptureSource());
  }

  private Integer calculatedMinutes(StaffingAssignmentResult value) {
    var workType = value.getAssignment().getRequirement().getWorkType();
    if (workType.getCalculationMethod()
        == com.alveryn.api.worktype.entity.CalculationMethod.UNITS_PER_HOUR_BASED
        && value.getCompletedQuantity() != null && workType.getUnitsPerHour() != null
        && workType.getUnitsPerHour().signum() > 0) {
      return value.getCompletedQuantity().multiply(java.math.BigDecimal.valueOf(60))
          .divide(workType.getUnitsPerHour(), 0, RoundingMode.HALF_UP).intValue();
    }
    if (value.getActualStartTime() == null || value.getActualEndTime() == null) return null;
    long minutes = Duration.between(value.getActualStartTime(), value.getActualEndTime()).toMinutes();
    if (minutes < 0) minutes += 24 * 60;
    return (int) Math.max(0, minutes - value.getBreakMinutes());
  }

  private static LocalDate weekStart(LocalDate date) {
    return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  }

  private static MapSqlParameterSource params(Object... values) {
    MapSqlParameterSource result = new MapSqlParameterSource();
    for (int index = 0; index < values.length; index += 2) {
      result.addValue((String) values[index], values[index + 1]);
    }
    return result;
  }

  private record VersionRow(UUID planId, UUID unitId, UUID versionId, int versionNumber,
      OffsetDateTime publishedAt, LocalDate weekStart) {}
  private record SnapshotAssignment(UUID versionId, UUID assignmentId, LocalDate date,
      UUID unitId, String unitName, UUID workTypeId, String workTypeCode, String workTypeName,
      LocalTime start, LocalTime end, String checkInMode) {}
  private record SnapshotDay(UUID versionId, UUID entryId, LocalDate date, String status,
      String notes) {}
}
