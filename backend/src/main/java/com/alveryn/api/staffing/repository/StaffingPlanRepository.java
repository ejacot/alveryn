package com.alveryn.api.staffing.repository;

import com.alveryn.api.staffing.entity.StaffingPlan;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface StaffingPlanRepository extends JpaRepository<StaffingPlan, UUID> {
  Optional<StaffingPlan> findByOrganizationIdAndUnitIdAndWeekStart(
      UUID organizationId, UUID unitId, LocalDate weekStart);

  Optional<StaffingPlan> findByIdAndOrganizationIdAndUnitId(
      UUID id, UUID organizationId, UUID unitId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select plan from StaffingPlan plan where plan.id = :planId "
      + "and plan.organization.id = :organizationId and plan.unit.id = :unitId")
  Optional<StaffingPlan> lockByScope(@Param("organizationId") UUID organizationId,
      @Param("unitId") UUID unitId, @Param("planId") UUID planId);
}
