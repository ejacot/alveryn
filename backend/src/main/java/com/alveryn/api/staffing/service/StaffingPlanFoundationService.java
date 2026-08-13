package com.alveryn.api.staffing.service;

import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.staffing.entity.StaffingPlan;
import com.alveryn.api.staffing.entity.StaffingPlanDay;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.repository.StaffingPlanDayRepository;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StaffingPlanFoundationService {
  private final StaffingPlanRepository plans;
  private final StaffingPlanDayRepository days;
  private final OrganizationRepository organizations;
  private final OrganizationUnitRepository units;
  private final OrganizationMembershipRepository memberships;

  @Transactional
  public StaffingPlan getOrCreate(
      UUID organizationId, UUID unitId, LocalDate weekStart, UUID actorMembershipId) {
    requireMonday(weekStart);
    var organization = organizations.findById(organizationId)
        .filter(value -> value.getOrganizationType() == OrganizationType.BUSINESS)
        .orElseThrow(() -> new NotFoundException("Business organization", organizationId));
    var unit = units.findByIdAndOrganizationId(unitId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization unit", unitId));
    var actor = activeMembership(organizationId, actorMembershipId);
    return plans.findByOrganizationIdAndUnitIdAndWeekStart(organizationId, unitId, weekStart)
        .orElseGet(() -> plans.saveAndFlush(
            new StaffingPlan(organization, unit, weekStart, organization.getTimezone(), actor)));
  }

  @Transactional
  public StaffingPlanDay createDay(
      UUID organizationId,
      UUID unitId,
      UUID planId,
      LocalDate date,
      Integer roomsContext,
      String notes,
      StaffingPlanDaySource source,
      UUID actorMembershipId) {
    var plan = plans.findByIdAndOrganizationIdAndUnitId(planId, organizationId, unitId)
        .orElseThrow(() -> new NotFoundException("Staffing plan", planId));
    var actor = activeMembership(organizationId, actorMembershipId);
    requirePlanDate(plan, date);
    if (days.findByPlanIdAndOrganizationIdAndDate(planId, organizationId, date).isPresent()) {
      throw new ConflictException("A staffing plan day already exists for " + date);
    }
    var day = days.saveAndFlush(new StaffingPlanDay(plan, date, roomsContext, notes, source));
    plan.markDraftChanged(actor);
    return day;
  }

  @Transactional(readOnly = true)
  public StaffingPlan getScoped(UUID organizationId, UUID unitId, UUID planId) {
    return plans.findByIdAndOrganizationIdAndUnitId(planId, organizationId, unitId)
        .orElseThrow(() -> new NotFoundException("Staffing plan", planId));
  }

  private OrganizationMembership activeMembership(UUID organizationId, UUID membershipId) {
    return memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .filter(value -> value.getStatus() == MembershipStatus.ACTIVE)
        .orElseThrow(() -> new NotFoundException("Active organization membership", membershipId));
  }

  private void requireMonday(LocalDate weekStart) {
    if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
      throw new IllegalArgumentException("week start must be Monday");
    }
  }

  private void requirePlanDate(StaffingPlan plan, LocalDate date) {
    if (date == null || !plan.includes(date)) {
      throw new IllegalArgumentException("work date must belong to plan week");
    }
  }
}
