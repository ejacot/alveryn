package com.alveryn.api.staffing.service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** The only mutable gateway for immutable staffing-plan publication rows. */
@Component
@RequiredArgsConstructor
class StaffingPlanPublicationWriter {
  private final NamedParameterJdbcTemplate jdbc;

  Optional<Operation> findOperation(UUID organizationId, UUID planId, String key) {
    return jdbc.query("""
        select id, request_fingerprint, source_fingerprint, operation_status,
               resulting_version_id, completed_at
        from staffing_plan_publication_operations
        where organization_id = :organizationId and plan_id = :planId and idempotency_key = :key
        """, params("organizationId", organizationId, "planId", planId, "key", key),
        (rs, row) -> operation(rs)).stream().findFirst();
  }

  void startOperation(UUID id, UUID organizationId, UUID unitId, UUID planId, String key,
      String requestFingerprint, long expectedRevision, OffsetDateTime now) {
    jdbc.update("""
        insert into staffing_plan_publication_operations (
          id, organization_id, unit_id, plan_id, idempotency_key, request_fingerprint,
          expected_draft_revision, operation_status, created_at
        ) values (:id, :organizationId, :unitId, :planId, :key, :fingerprint,
          :revision, 'PROCESSING', :now)
        """, params("id", id, "organizationId", organizationId, "unitId", unitId,
        "planId", planId, "key", key, "fingerprint", requestFingerprint,
        "revision", expectedRevision, "now", now));
  }

  int nextVersionNumber(UUID planId) {
    Integer value = jdbc.queryForObject(
        "select coalesce(max(version_number), 0) + 1 from staffing_plan_versions where plan_id = :planId",
        params("planId", planId), Integer.class);
    return Objects.requireNonNull(value);
  }

  String sourceFingerprint(UUID organizationId, UUID unitId, UUID planId) {
    return jdbc.queryForObject("""
        select encode(sha256(convert_to(concat(
          'plan:', jsonb_build_array(p.organization_id::text, p.unit_id::text,
             p.week_start::text, p.timezone, p.draft_revision::text)::text,
          '|days:', coalesce((select jsonb_agg(jsonb_build_array(d.id::text, d.work_date::text,
             d.rooms_context::text, d.notes, d.source) order by d.work_date, d.id)::text
             from staffing_plan_days d where d.plan_id = p.id), '[]'),
          '|requirements:', coalesce((select jsonb_agg(jsonb_build_array(r.id::text,
             r.plan_day_id::text, r.work_date::text, r.unit_id::text, u.name, r.work_type_id::text,
             wt.code, wt.name, wt.default_break_minutes::text, wt.active,
             r.start_time::text, r.end_time::text, r.required_workers::text,
             r.required_quantity::text, r.notes, r.publication_status)
             order by r.work_date, r.start_time, r.work_type_id, r.id)::text
             from staffing_requirements r join staffing_plan_days d on d.id = r.plan_day_id
             join organization_units u on u.id = r.unit_id
             join organization_work_types wt on wt.id = r.work_type_id
             where d.plan_id = p.id), '[]'),
          '|assignments:', coalesce((select jsonb_agg(jsonb_build_array(a.id::text,
             a.requirement_id::text, a.membership_id::text, a.start_time::text, a.end_time::text,
             a.assignment_status, m.membership_status, m.first_name, m.last_name,
             u.name, u.check_in_mode, wt.code, wt.name, wt.active)
             order by r.work_date, a.requirement_id, a.membership_id, a.id)::text
             from staffing_assignments a join staffing_requirements r on r.id = a.requirement_id
             join staffing_plan_days d on d.id = r.plan_day_id
             join organization_memberships m on m.id = a.membership_id
             join organization_units u on u.id = r.unit_id
             join organization_work_types wt on wt.id = r.work_type_id
             where d.plan_id = p.id), '[]'),
          '|memberDays:', coalesce((select jsonb_agg(jsonb_build_array(e.id::text,
             e.membership_id::text, m.first_name, m.last_name, e.work_date::text,
             e.entry_type, e.notes)
             order by e.work_date, e.membership_id, e.id)::text
             from staffing_member_day_entries e join organization_memberships m on m.id=e.membership_id
             where e.organization_id = p.organization_id
             and e.work_date between p.week_start and p.week_start + 6
             and exists (select 1 from staffing_assignments a
               join staffing_requirements r on r.id = a.requirement_id
               join staffing_plan_days d on d.id = r.plan_day_id
               where d.plan_id = p.id and a.membership_id = e.membership_id)), '[]')
          ,'|absenceRequests:', coalesce((select jsonb_agg(jsonb_build_array(ar.id::text,
             ar.membership_id::text, ar.absence_type, ar.start_date::text, ar.end_date::text,
             ar.request_status) order by ar.start_date, ar.membership_id, ar.id)::text
             from staffing_absence_requests ar where ar.organization_id=p.organization_id
             and ar.request_status='PENDING' and ar.end_date>=p.week_start
             and ar.start_date<=p.week_start+6 and exists(select 1 from staffing_assignments a
               join staffing_requirements r on r.id=a.requirement_id
               join staffing_plan_days d on d.id=r.plan_day_id
               where d.plan_id=p.id and a.membership_id=ar.membership_id)), '[]')
        ), 'UTF8')), 'hex')
        from staffing_plans p
        where p.id = :planId and p.organization_id = :organizationId and p.unit_id = :unitId
        """, params("organizationId", organizationId, "unitId", unitId, "planId", planId),
        String.class);
  }

  void insertVersion(UUID versionId, UUID organizationId, UUID unitId, UUID planId,
      int versionNumber, long revision, UUID previousVersionId, UUID publisherId,
      String publisherName, OffsetDateTime publishedAt, String timezone,
      java.time.LocalDate weekStart, StaffingPlanCoverageService.CoverageResult coverage,
      int warningCount, String note) {
    jdbc.update("""
        insert into staffing_plan_versions (id,organization_id,unit_id,plan_id,version_number,
          source_draft_revision,previous_version_id,published_by_membership_id,published_by_display_name,
          published_at,timezone,week_start,coverage_required,coverage_assigned,
          coverage_raw_assigned,coverage_effective_assigned,coverage_covered,coverage_missing,
          coverage_overstaffed,coverage_percentage,
          coverage_basis,warning_count,checksum,checksum_format_version,publication_kind,
          source_draft_complete,publication_note,created_at)
        values (:id,:org,:unit,:plan,:number,:revision,:previous,:publisher,:publisherName,:publishedAt,
          :timezone,:weekStart,:required,:effectiveAssigned,:rawAssigned,:effectiveAssigned,:covered,
          :missing,:overstaffed,:percentage,'CANONICAL_REQUIREMENT_V1',:warningCount,:checksum,2,
          'ATOMIC_WEEKLY',true,:note,:publishedAt)
        """, params("id",versionId,"org",organizationId,"unit",unitId,"plan",planId,
        "number",versionNumber,"revision",revision,"previous",previousVersionId,"publisher",publisherId,
        "publisherName",publisherName,"publishedAt",publishedAt,"timezone",timezone,"weekStart",weekStart,
        "required",coverage.required(),"rawAssigned",coverage.assigned(),
        "effectiveAssigned",coverage.effectiveAssigned(),"covered",coverage.covered(),
        "missing",coverage.missing(),"overstaffed",coverage.overstaffed(),
        "percentage",coverage.percentage(),
        "warningCount",warningCount,"checksum","0".repeat(64),"note",note));
  }

  void snapshotDaysAndRequirements(UUID versionId, UUID planId, UUID organizationId,
      OffsetDateTime createdAt) {
    var p = params("version",versionId,"plan",planId,"organization",organizationId,"createdAt",createdAt);
    jdbc.update("""
      insert into staffing_plan_version_days(id,version_id,source_plan_day_id,work_date,rooms_context,notes,source,created_at)
      select gen_random_uuid(),:version,d.id,d.work_date,d.rooms_context,d.notes,d.source,:createdAt
      from staffing_plan_days d where d.plan_id=:plan order by d.work_date,d.id
      """, p);
    jdbc.update("""
      insert into staffing_plan_version_requirements(id,version_id,version_day_id,source_requirement_id,
        source_plan_day_id,work_date,unit_id,unit_name,work_type_id,work_type_code,work_type_name,
        start_time,end_time,break_minutes,required_workers,required_quantity,legacy_publication_status,notes,created_at)
      select gen_random_uuid(),:version,vd.id,r.id,d.id,r.work_date,r.unit_id,u.name,r.work_type_id,
        wt.code,wt.name,r.start_time,r.end_time,wt.default_break_minutes,r.required_workers,
        r.required_quantity,r.publication_status,r.notes,:createdAt
      from staffing_requirements r join staffing_plan_days d on d.id=r.plan_day_id
      join staffing_plan_version_days vd on vd.version_id=:version and vd.source_plan_day_id=d.id
      join organization_units u on u.id=r.unit_id join organization_work_types wt on wt.id=r.work_type_id
      where d.plan_id=:plan order by r.work_date,r.start_time,r.id
      """, p);
  }

  void snapshotAssignments(UUID versionId, UUID planId, UUID organizationId,
      OffsetDateTime createdAt) {
    var p = params("version",versionId,"plan",planId,"organization",organizationId,"createdAt",createdAt);
    jdbc.update("""
      insert into staffing_plan_version_assignments(id,version_id,version_requirement_id,source_assignment_id,
        source_requirement_id,organization_membership_id,member_display_name,membership_status_snapshot,
        work_date,unit_id,unit_name,work_type_id,work_type_code,work_type_name,start_time,end_time,
        assignment_status,check_in_mode,checked_in_at,checked_out_at,created_at)
      select gen_random_uuid(),:version,vr.id,a.id,r.id,m.id,
        coalesce(nullif(btrim(concat_ws(' ',m.first_name,m.last_name)),''),'Member '||left(m.id::text,8)),
        m.membership_status,r.work_date,r.unit_id,u.name,r.work_type_id,wt.code,wt.name,
        coalesce(a.start_time,r.start_time),coalesce(a.end_time,r.end_time),a.assignment_status,
        u.check_in_mode,null,null,:createdAt
      from staffing_assignments a join staffing_requirements r on r.id=a.requirement_id
      join staffing_plan_days d on d.id=r.plan_day_id
      join staffing_plan_version_requirements vr on vr.version_id=:version and vr.source_requirement_id=r.id
      join organization_memberships m on m.id=a.membership_id join organization_units u on u.id=r.unit_id
      join organization_work_types wt on wt.id=r.work_type_id
      where d.plan_id=:plan order by r.work_date,a.id
      """, p);
  }

  void snapshotMemberDays(UUID versionId, UUID planId, UUID organizationId,
      OffsetDateTime createdAt) {
    var p = params("version",versionId,"plan",planId,"organization",organizationId,"createdAt",createdAt);
    jdbc.update("""
      insert into staffing_plan_version_member_days(id,version_id,source_day_entry_id,
        organization_membership_id,member_display_name,work_date,status,notes,source,source_request_id,created_at)
      select gen_random_uuid(),:version,e.id,m.id,
        coalesce(nullif(btrim(concat_ws(' ',m.first_name,m.last_name)),''),'Member '||left(m.id::text,8)),
        e.work_date,e.entry_type,e.notes,'LEGACY_DAY_ENTRY',null,:createdAt
      from staffing_member_day_entries e join organization_memberships m on m.id=e.membership_id
      join staffing_plans p2 on p2.id=:plan
      where e.organization_id=:organization and e.work_date between p2.week_start and p2.week_start+6
        and exists(select 1 from staffing_plan_version_assignments va where va.version_id=:version
          and va.organization_membership_id=e.membership_id)
      order by e.work_date,e.membership_id,e.id
      """, p);
  }

  void snapshotRequirementCoverage(UUID versionId, UUID organizationId, UUID unitId,
      java.time.LocalDate weekStart, StaffingPlanCoverageService.CoverageResult coverage,
      OffsetDateTime createdAt) {
    Map<UUID, UUID> versionRequirementIds = new HashMap<>();
    jdbc.query("""
        select id, source_requirement_id
        from staffing_plan_version_requirements
        where version_id=:version
        """, params("version", versionId), (org.springframework.jdbc.core.RowCallbackHandler) rs ->
        versionRequirementIds.put(rs.getObject("source_requirement_id", UUID.class),
            rs.getObject("id", UUID.class)));
    Set<UUID> snapshotRequirementIds = Set.copyOf(versionRequirementIds.keySet());
    Set<UUID> coverageRequirementIds = coverage.requirementCoverage().stream()
        .map(StaffingPlanCoverageService.RequirementCoverage::requirementId)
        .collect(java.util.stream.Collectors.toSet());
    if (coverageRequirementIds.size() != coverage.requirementCoverage().size()
        || !snapshotRequirementIds.equals(coverageRequirementIds)) {
      throw new IllegalStateException("Coverage does not match the requirement snapshot");
    }
    for (StaffingPlanCoverageService.RequirementCoverage value : coverage.requirementCoverage()) {
      UUID versionRequirementId = versionRequirementIds.get(value.requirementId());
      if (versionRequirementId == null) {
        throw new IllegalStateException("Coverage references an unknown requirement snapshot");
      }
      jdbc.update("""
          insert into staffing_plan_version_requirement_coverage (
            id,organization_id,unit_id,version_id,week_start,version_requirement_id,
            source_requirement_id,work_date,required,raw_assigned,effective_assigned,
            covered,missing,overstaffed,percentage,open_positions,created_at)
          values (:id,:organization,:unit,:version,:weekStart,:versionRequirement,
            :sourceRequirement,:date,:required,:rawAssigned,:effectiveAssigned,
            :covered,:missing,:overstaffed,:percentage,:openPositions,:createdAt)
          """, params("id", UUID.randomUUID(), "organization", organizationId, "unit", unitId,
          "version", versionId, "weekStart", weekStart,
          "versionRequirement", versionRequirementId,
          "sourceRequirement", value.requirementId(), "date", value.date(),
          "required", value.required(), "rawAssigned", value.assigned(),
          "effectiveAssigned", value.effectiveAssigned(), "covered", value.covered(),
          "missing", value.missing(), "overstaffed", value.overstaffed(),
          "percentage", value.percentage(), "openPositions", value.missing(),
          "createdAt", createdAt));
    }
  }

  void snapshotDayCoverage(UUID versionId, UUID organizationId, UUID unitId,
      java.time.LocalDate weekStart, StaffingPlanCoverageService.CoverageResult coverage,
      OffsetDateTime createdAt) {
    if (coverage.dayCoverage().size() != 7) {
      throw new IllegalStateException("Atomic weekly coverage must contain exactly seven days");
    }
    for (StaffingPlanCoverageService.DayCoverage value : coverage.dayCoverage()) {
      jdbc.update("""
          insert into staffing_plan_version_day_coverage (
            id,organization_id,unit_id,version_id,week_start,work_date,required,
            raw_assigned,effective_assigned,covered,missing,overstaffed,percentage,
            open_positions,created_at)
          values (:id,:organization,:unit,:version,:weekStart,:date,:required,
            :rawAssigned,:effectiveAssigned,:covered,:missing,:overstaffed,:percentage,
            :openPositions,:createdAt)
          """, params("id", UUID.randomUUID(), "organization", organizationId, "unit", unitId,
          "version", versionId, "weekStart", weekStart, "date", value.date(),
          "required", value.required(), "rawAssigned", value.assigned(),
          "effectiveAssigned", value.effectiveAssigned(), "covered", value.covered(),
          "missing", value.missing(), "overstaffed", value.overstaffed(),
          "percentage", value.percentage(), "openPositions", value.openPositions(),
          "createdAt", createdAt));
    }
  }

  void acknowledgements(UUID versionId,
      Collection<StaffingPlanCoverageService.PlanningIssue> acknowledged, UUID publisherId,
      String publisherName, OffsetDateTime now) {
    for (StaffingPlanCoverageService.PlanningIssue issue : acknowledged) jdbc.update("""
        insert into staffing_plan_version_acknowledgements(id,version_id,issue_key,severity,
          acknowledged_by_membership_id,acknowledged_by_display_name,acknowledged_at,created_at)
        values (:id,:version,:key,:severity,:publisher,:publisherName,:now,:now)
        """, params("id",UUID.randomUUID(),"version",versionId,"key",issue.issueKey(),
        "severity",issue.severity().name(),"publisher",publisherId,"publisherName",publisherName,"now",now));
  }

  String calculateAndStoreChecksum(UUID versionId) {
    jdbc.update("""
      update staffing_plan_versions v set checksum=encode(sha256(convert_to(concat(
        'header:',jsonb_build_array(v.organization_id::text,v.unit_id::text,v.version_number::text,
          v.source_draft_revision::text,v.timezone,to_char(v.week_start,'YYYY-MM-DD'),
          v.coverage_required::text,v.coverage_assigned::text,v.coverage_raw_assigned::text,
          v.coverage_effective_assigned::text,v.coverage_covered::text,
          v.coverage_missing::text,v.coverage_overstaffed::text,v.coverage_percentage::text,
          v.coverage_basis,v.warning_count::text,v.checksum_format_version::text,
          v.publication_kind,v.source_draft_complete,v.publication_note)::text,
        '|days:',coalesce((select jsonb_agg(jsonb_build_array(to_char(d.work_date,'YYYY-MM-DD'),
          d.rooms_context::text,d.notes,d.source) order by d.work_date)::text from staffing_plan_version_days d where d.version_id=v.id),'[]'),
        '|requirements:',coalesce((select jsonb_agg(jsonb_build_array(r.source_requirement_id::text,
          to_char(r.work_date,'YYYY-MM-DD'),r.unit_id::text,r.unit_name,r.work_type_id,r.work_type_code,
          r.work_type_name,to_char(r.start_time,'HH24:MI:SS.US'),to_char(r.end_time,'HH24:MI:SS.US'),
          r.break_minutes::text,r.required_workers::text,r.required_quantity::text,r.legacy_publication_status,r.notes)
          order by r.work_date,r.start_time,r.work_type_code,r.source_requirement_id)::text
          from staffing_plan_version_requirements r where r.version_id=v.id),'[]'),
        '|assignments:',coalesce((select jsonb_agg(jsonb_build_array(a.source_assignment_id::text,
          a.source_requirement_id::text,a.organization_membership_id::text,a.member_display_name,
          a.membership_status_snapshot,to_char(a.work_date,'YYYY-MM-DD'),a.unit_id::text,a.unit_name,
          a.work_type_id::text,a.work_type_code,a.work_type_name,to_char(a.start_time,'HH24:MI:SS.US'),
          to_char(a.end_time,'HH24:MI:SS.US'),a.assignment_status,a.check_in_mode,
          to_char(a.checked_in_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),
          to_char(a.checked_out_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'))
          order by a.work_date,a.work_type_code,a.organization_membership_id,a.source_assignment_id)::text
          from staffing_plan_version_assignments a where a.version_id=v.id),'[]'),
        '|memberDays:',coalesce((select jsonb_agg(jsonb_build_array(md.source_day_entry_id::text,
          md.organization_membership_id::text,md.member_display_name,to_char(md.work_date,'YYYY-MM-DD'),
          md.status,md.notes,md.source,md.source_request_id::text)
          order by md.work_date,md.organization_membership_id,md.source_day_entry_id)::text
          from staffing_plan_version_member_days md where md.version_id=v.id),'[]'),
        '|acknowledgements:',coalesce((select jsonb_agg(jsonb_build_array(a.issue_key,a.severity,
          a.acknowledged_by_membership_id::text,a.acknowledged_by_display_name,
          to_char(a.acknowledged_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),a.note)
          order by a.issue_key)::text from staffing_plan_version_acknowledgements a where a.version_id=v.id),'[]'),
        '|requirementCoverage:',coalesce((select jsonb_agg(jsonb_build_array(
          c.source_requirement_id::text,to_char(c.work_date,'YYYY-MM-DD'),c.required::text,
          c.raw_assigned::text,c.effective_assigned::text,c.covered::text,c.missing::text,
          c.overstaffed::text,c.percentage::text,c.open_positions::text)
          order by c.work_date,c.source_requirement_id)::text
          from staffing_plan_version_requirement_coverage c where c.version_id=v.id),'[]'),
        '|dayCoverage:',coalesce((select jsonb_agg(jsonb_build_array(
          to_char(c.work_date,'YYYY-MM-DD'),c.required::text,c.raw_assigned::text,
          c.effective_assigned::text,c.covered::text,c.missing::text,c.overstaffed::text,
          c.percentage::text,c.open_positions::text) order by c.work_date)::text
          from staffing_plan_version_day_coverage c where c.version_id=v.id),'[]')
      ),'UTF8')),'hex') where v.id=:version
      """, params("version",versionId));
    return jdbc.queryForObject("select checksum from staffing_plan_versions where id=:version",
        params("version",versionId), String.class);
  }

  void completeOperation(UUID operationId, UUID versionId, String sourceFingerprint, OffsetDateTime now) {
    jdbc.update("""
        update staffing_plan_publication_operations set operation_status='COMPLETED',
          resulting_version_id=:version,source_fingerprint=:source,completed_at=:now
        where id=:id and operation_status='PROCESSING'
        """, params("version",versionId,"source",sourceFingerprint,"now",now,"id",operationId));
  }

  VersionSummary versionSummary(UUID organizationId, UUID unitId, UUID planId, UUID versionId) {
    return jdbc.queryForObject("""
        select id,version_number,source_draft_revision,published_at,checksum,publication_kind,
          coverage_required,coverage_assigned,coverage_raw_assigned,
          coverage_effective_assigned,coverage_covered,coverage_missing,coverage_overstaffed,
          coverage_percentage,warning_count
        from staffing_plan_versions where id=:version and organization_id=:organization
          and unit_id=:unit and plan_id=:plan
        """, params("version",versionId,"organization",organizationId,"unit",unitId,"plan",planId),
        (rs,row)->new VersionSummary(rs.getObject("id",UUID.class),rs.getInt("version_number"),
          rs.getLong("source_draft_revision"),rs.getObject("published_at",OffsetDateTime.class),
          rs.getString("checksum"),rs.getString("publication_kind"),rs.getInt("coverage_required"),
          rs.getInt("coverage_assigned"),(Integer)rs.getObject("coverage_raw_assigned"),
          (Integer)rs.getObject("coverage_effective_assigned"),(Integer)rs.getObject("coverage_covered"),
          (Integer)rs.getObject("coverage_missing"),(Integer)rs.getObject("coverage_overstaffed"),
          rs.getBigDecimal("coverage_percentage"),rs.getInt("warning_count")));
  }

  private static MapSqlParameterSource params(Object... values) {
    var result = new MapSqlParameterSource();
    for (int i=0;i<values.length;i+=2) result.addValue((String) values[i], values[i+1]);
    return result;
  }

  private static Operation operation(ResultSet rs) throws SQLException {
    return new Operation(rs.getObject("id",UUID.class),rs.getString("request_fingerprint"),
        rs.getString("source_fingerprint"),rs.getString("operation_status"),
        rs.getObject("resulting_version_id",UUID.class),rs.getObject("completed_at",OffsetDateTime.class));
  }

  record Operation(UUID id,String requestFingerprint,String sourceFingerprint,String status,
                   UUID versionId,OffsetDateTime completedAt) {}
  record VersionSummary(UUID id,int versionNumber,long revision,OffsetDateTime publishedAt,
      String checksum,String publicationKind,int required,int assigned,Integer rawAssigned,
      Integer effectiveAssigned,Integer covered,Integer missing,Integer overstaffed,
      BigDecimal percentage,int warningCount) {}
}
