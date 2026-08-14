package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingRequirement;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface StaffingRequirementRepository extends JpaRepository<StaffingRequirement, UUID> {
  interface RequirementPlanScope {
    UUID getPlanId();
    UUID getUnitId();
  }
  List<StaffingRequirement> findAllByOrganizationIdAndDateBetweenOrderByDateAscStartTimeAsc(UUID organizationId, LocalDate from, LocalDate to);
  @Query("""
      select requirement from StaffingRequirement requirement
      join fetch requirement.organization
      join fetch requirement.unit
      join fetch requirement.workType
      join fetch requirement.planDay planDay
      join fetch planDay.plan plan
      join fetch plan.organization
      join fetch plan.unit
      where requirement.organization.id = :organizationId
        and requirement.date between :from and :to
      order by requirement.date asc, requirement.startTime asc, requirement.id asc
      """)
  List<StaffingRequirement> findAllForManagerRange(
      @Param("organizationId") UUID organizationId,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to);
  Optional<StaffingRequirement> findByIdAndOrganizationId(UUID id, UUID organizationId);

  @Query("""
      select plan.id as planId, plan.unit.id as unitId
      from StaffingRequirement requirement
      join requirement.planDay day
      join day.plan plan
      where requirement.id = :requirementId and requirement.organization.id = :organizationId
      """)
  Optional<RequirementPlanScope> findPlanScope(
      @Param("organizationId") UUID organizationId,
      @Param("requirementId") UUID requirementId);
}
