package com.alveryn.api.organization.service;

import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.organization.dto.BusinessEmployeeTerms.*;
import com.alveryn.api.organization.entity.OrganizationPermission;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.user.entity.EmploymentType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BusinessEmployeeProfileService {
  private final OrganizationAccessService access;
  private final OrganizationMembershipRepository memberships;
  private final JdbcTemplate jdbc;
  private final Clock clock;

  @Transactional(readOnly = true)
  public Profile get(UUID organizationId, UUID membershipId, LocalDate from, LocalDate to) {
    access.requireForUnit(organizationId, null, OrganizationPermission.MANAGE_MEMBERS);
    var member = memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization member", membershipId));
    if (to.isBefore(from) || to.isAfter(from.plusDays(366))) {
      throw new IllegalArgumentException("invalid profile date range");
    }
    var terms = terms(membershipId);
    var today = LocalDate.now(clock.withZone(ZoneId.of(member.getOrganization().getTimezone())));
    var current = effective(terms, today);
    BigDecimal contractual = BigDecimal.ZERO;
    boolean contractKnown = false;
    for (var date = from; !date.isAfter(to); date = date.plusDays(1)) {
      var term = effective(terms, date);
      if (term == null) continue;
      contractKnown = true;
      if (date.isBefore(term.employmentStart()) ||
          (term.employmentEnd() != null && date.isAfter(term.employmentEnd())) ||
          !term.workingDays().contains(date.getDayOfWeek())) continue;
      contractual = contractual.add(BigDecimal.valueOf(term.weeklyMinutes())
          .divide(BigDecimal.valueOf(term.workingDays().size()), 8, RoundingMode.HALF_UP));
    }
    Integer approved = null;
    if (access.canAccess(organizationId, null, OrganizationPermission.VIEW_TEAM_HOURS)) {
      approved = jdbc.queryForObject("""
          SELECT COALESCE(SUM(CASE
            WHEN w.calculation_method = 'UNITS_PER_HOUR_BASED'
              AND r.completed_quantity IS NOT NULL AND w.units_per_hour > 0
              THEN ROUND(r.completed_quantity * 60 / w.units_per_hour)
            WHEN r.actual_start_time IS NOT NULL AND r.actual_end_time IS NOT NULL THEN
              GREATEST(0, EXTRACT(EPOCH FROM (r.actual_end_time - r.actual_start_time)) / 60
                + CASE WHEN r.actual_end_time < r.actual_start_time THEN 1440 ELSE 0 END
                - r.break_minutes)
            ELSE 0 END), 0)::integer
          FROM staffing_assignment_results r
          JOIN staffing_assignments a ON a.id = r.assignment_id
          JOIN staffing_requirements q ON q.id = a.requirement_id
          JOIN organization_work_types w ON w.id = q.work_type_id
          WHERE a.membership_id = ? AND q.organization_id = ?
            AND q.work_date BETWEEN ? AND ? AND r.approval_status = 'APPROVED'
            AND a.assignment_status = 'ASSIGNED'
          """, Integer.class, membershipId, organizationId, from, to);
    }
    var absences = jdbc.query("""
        SELECT id, work_date AS date_from, work_date AS date_to, entry_type AS absence_type,
          'APPROVED' AS status, notes
        FROM staffing_member_day_entries
        WHERE organization_id = ? AND membership_id = ? AND work_date BETWEEN ? AND ?
        UNION ALL
        SELECT id, start_date, end_date, absence_type, request_status, notes
        FROM staffing_absence_requests
        WHERE organization_id = ? AND membership_id = ? AND start_date <= ? AND end_date >= ?
          AND request_status <> 'APPROVED'
        ORDER BY date_from, id
        """, (rs, row) -> new Absence(rs.getObject("id", UUID.class),
            rs.getObject("date_from", LocalDate.class), rs.getObject("date_to", LocalDate.class),
            rs.getString("absence_type"), rs.getString("status"), rs.getString("notes")),
        organizationId, membershipId, from, to, organizationId, membershipId, to, from);
    return new Profile(terms, current,
        contractKnown ? contractual.setScale(2, RoundingMode.HALF_UP) : null, approved, from, to, absences);
  }

  @Transactional
  public Term add(UUID organizationId, UUID membershipId, Input input) {
    var actor = access.requireForUnit(organizationId, null, OrganizationPermission.MANAGE_MEMBERS);
    memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization member", membershipId));
    jdbc.queryForObject("SELECT id FROM organization_memberships WHERE id = ? FOR UPDATE", UUID.class, membershipId);
    if (input.employmentEnd() != null && input.employmentEnd().isBefore(input.employmentStart())) {
      throw new IllegalArgumentException("employment end must follow start");
    }
    if (input.weeklyMinutes() > 0 && input.workingDays().isEmpty()) {
      throw new IllegalArgumentException("working days are required for weekly hours");
    }
    if (input.compensationType() == CompensationType.FIXED_AMOUNT ||
        (input.compensationType() == CompensationType.PER_UNIT &&
            (input.unitLabel() == null || input.unitLabel().isBlank()))) {
      throw new IllegalArgumentException("invalid payment method or missing unit");
    }
    if (input.primaryUnitId() != null && !Boolean.TRUE.equals(jdbc.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM organization_units WHERE id = ? AND organization_id = ? AND active)",
        Boolean.class, input.primaryUnitId(), organizationId))) {
      throw new IllegalArgumentException("primary location must be active and belong to this organization");
    }
    var existing = terms(membershipId);
    if (!existing.isEmpty() && !input.validFrom().isAfter(existing.getFirst().validFrom())) {
      throw new ConflictException("New terms must start after the latest saved terms");
    }
    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO business_employee_terms
          (id, membership_id, valid_from, job_title, employment_type, employment_start,
           employment_end, primary_unit_id, weekly_minutes, working_days, compensation_type,
           gross_amount, currency, unit_label, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, id, membershipId, input.validFrom(), clean(input.jobTitle()), input.employmentType().name(),
        input.employmentStart(), input.employmentEnd(), input.primaryUnitId(), input.weeklyMinutes(),
        input.workingDays().stream().sorted().map(day -> Integer.toString(day.getValue())).collect(Collectors.joining(",")),
        input.compensationType().name(), input.grossAmount(), input.currency().toUpperCase(Locale.ROOT),
        clean(input.unitLabel()), actor.getId());
    return terms(membershipId).getFirst();
  }

  private List<Term> terms(UUID membershipId) {
    return jdbc.query("""
        SELECT t.*, LEAD(t.valid_from) OVER (ORDER BY t.valid_from) - 1 AS valid_to,
          u.name AS primary_unit_name
        FROM business_employee_terms t LEFT JOIN organization_units u ON u.id = t.primary_unit_id
        WHERE t.membership_id = ? ORDER BY t.valid_from DESC
        """, (rs, row) -> {
          Set<DayOfWeek> days = new LinkedHashSet<>();
          for (String day : rs.getString("working_days").split(",")) {
            if (!day.isBlank()) days.add(DayOfWeek.of(Integer.parseInt(day)));
          }
          return new Term(rs.getObject("id", UUID.class), rs.getObject("valid_from", LocalDate.class),
              rs.getObject("valid_to", LocalDate.class), rs.getString("job_title"),
              EmploymentType.valueOf(rs.getString("employment_type")), rs.getObject("employment_start", LocalDate.class),
              rs.getObject("employment_end", LocalDate.class), rs.getObject("primary_unit_id", UUID.class),
              rs.getString("primary_unit_name"), rs.getInt("weekly_minutes"), days,
              CompensationType.valueOf(rs.getString("compensation_type")), rs.getBigDecimal("gross_amount"),
              rs.getString("currency"), rs.getString("unit_label"), rs.getObject("created_at", OffsetDateTime.class));
        }, membershipId);
  }

  private Term effective(List<Term> terms, LocalDate date) {
    return terms.stream().filter(term -> !term.validFrom().isAfter(date) &&
        (term.validTo() == null || !term.validTo().isBefore(date))).findFirst().orElse(null);
  }

  private String clean(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
