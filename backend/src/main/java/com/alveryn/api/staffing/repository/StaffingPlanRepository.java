package com.alveryn.api.staffing.repository;

import com.alveryn.api.staffing.entity.StaffingPlan;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;

public interface StaffingPlanRepository extends JpaRepository<StaffingPlan, UUID> {
  interface PlanScope {
    UUID getPlanId();
    UUID getUnitId();
  }

  Optional<StaffingPlan> findByOrganizationIdAndUnitIdAndWeekStart(
      UUID organizationId, UUID unitId, LocalDate weekStart);

  Optional<StaffingPlan> findByIdAndOrganizationIdAndUnitId(
      UUID id, UUID organizationId, UUID unitId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select plan from StaffingPlan plan where plan.id = :planId "
      + "and plan.organization.id = :organizationId and plan.unit.id = :unitId")
  Optional<StaffingPlan> lockByScope(@Param("organizationId") UUID organizationId,
      @Param("unitId") UUID unitId, @Param("planId") UUID planId);

  @Query("""
      select distinct plan.id as planId, plan.unit.id as unitId
      from StaffingRequirement requirement
      join requirement.planDay day
      join day.plan plan
      where requirement.organization.id = :organizationId
        and requirement.workType.id = :workTypeId
      """)
  List<PlanScope> findScopesUsingWorkType(@Param("organizationId") UUID organizationId,
      @Param("workTypeId") UUID workTypeId);

  @Query("""
      select distinct plan.id as planId, plan.unit.id as unitId
      from StaffingAssignment assignment
      join assignment.requirement requirement
      join requirement.planDay day
      join day.plan plan
      where requirement.organization.id = :organizationId
        and assignment.membership.id = :membershipId
        and plan.weekStart in :weekStarts
      """)
  List<PlanScope> findScopesForMemberWeeks(@Param("organizationId") UUID organizationId,
      @Param("membershipId") UUID membershipId,
      @Param("weekStarts") Collection<LocalDate> weekStarts);

  @Query("""
      select distinct plan.id as planId, plan.unit.id as unitId
      from StaffingAssignment assignment
      join assignment.requirement requirement
      join requirement.planDay day
      join day.plan plan
      where requirement.organization.id = :organizationId
        and assignment.membership.id = :membershipId
      """)
  List<PlanScope> findScopesForMember(@Param("organizationId") UUID organizationId,
      @Param("membershipId") UUID membershipId);
}
