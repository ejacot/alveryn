package com.alveryn.api.staffing.service;

import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.staffing.entity.StaffingPlan;
import com.alveryn.api.staffing.entity.StaffingPlanDay;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.repository.StaffingPlanDayRepository;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
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
  private final OrganizationMembershipRepository memberships;
  private final StaffingPlanFactory planFactory;
  private final StaffingPlanMutationCoordinator mutations;

  @Transactional
  public StaffingPlan getOrCreate(
      UUID organizationId, UUID unitId, LocalDate weekStart, UUID actorMembershipId) {
    return planFactory.getOrCreate(organizationId, unitId, weekStart, actorMembershipId);
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
    var actor = activeMembership(organizationId, actorMembershipId);
    return mutations.mutateScopes(organizationId,
        java.util.List.of(new StaffingPlanMutationCoordinator.Scope(planId, unitId)), actor, null,
        () -> {
          var plan = plans.findByIdAndOrganizationIdAndUnitId(planId, organizationId, unitId)
              .orElseThrow(() -> new NotFoundException("Staffing plan", planId));
          requirePlanDate(plan, date);
          if (days.findByPlanIdAndOrganizationIdAndDate(planId, organizationId, date).isPresent()) {
            throw new ConflictException("A staffing plan day already exists for " + date);
          }
          var day = days.saveAndFlush(
              new StaffingPlanDay(plan, date, roomsContext, notes, source));
          return StaffingPlanMutationCoordinator.Change.changed(day, day.getId());
        }).value();
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

  private void requirePlanDate(StaffingPlan plan, LocalDate date) {
    if (date == null || !plan.includes(date)) {
      throw new IllegalArgumentException("work date must belong to plan week");
    }
  }
}
