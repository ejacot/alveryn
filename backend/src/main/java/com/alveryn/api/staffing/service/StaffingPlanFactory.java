package com.alveryn.api.staffing.service;

import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.staffing.entity.StaffingPlan;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Internal creator used only from an already active weekly-aggregate transaction. */
@Component
@RequiredArgsConstructor
class StaffingPlanFactory {
  private final StaffingPlanRepository plans;
  private final OrganizationRepository organizations;
  private final OrganizationUnitRepository units;
  private final OrganizationMembershipRepository memberships;

  @Transactional(propagation = Propagation.MANDATORY)
  StaffingPlan getOrCreate(
      UUID organizationId, UUID unitId, LocalDate weekStart, UUID actorMembershipId) {
    return getOrCreateResult(organizationId, unitId, weekStart, actorMembershipId).plan();
  }

  @Transactional(propagation = Propagation.MANDATORY)
  CreationResult getOrCreateResult(
      UUID organizationId, UUID unitId, LocalDate weekStart, UUID actorMembershipId) {
    requireMonday(weekStart);
    var organization = organizations.findById(organizationId)
        .filter(value -> value.getOrganizationType() == OrganizationType.BUSINESS)
        .orElseThrow(() -> new NotFoundException("Business organization", organizationId));
    // The stable parent row is the creation mutex. This makes the first weekly-plan creation
    // deterministic without retrying a transaction already marked rollback-only by a unique-key race.
    var unit = units.lockByIdAndOrganizationId(unitId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization unit", unitId));
    var actor = activeMembership(organizationId, actorMembershipId);
    var existing = plans.findByOrganizationIdAndUnitIdAndWeekStart(
        organizationId, unitId, weekStart);
    if (existing.isPresent()) return new CreationResult(existing.get(), false);
    return new CreationResult(plans.saveAndFlush(
        new StaffingPlan(organization, unit, weekStart, organization.getTimezone(), actor)), true);
  }

  private OrganizationMembership activeMembership(UUID organizationId, UUID membershipId) {
    return memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .filter(value -> value.getStatus() == MembershipStatus.ACTIVE)
        .orElseThrow(() -> new NotFoundException("Active organization membership", membershipId));
  }

  private static void requireMonday(LocalDate weekStart) {
    if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
      throw new IllegalArgumentException("week start must be Monday");
    }
  }

  record CreationResult(StaffingPlan plan, boolean created) {}
}
