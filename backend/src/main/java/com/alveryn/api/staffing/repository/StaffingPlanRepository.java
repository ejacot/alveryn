package com.alveryn.api.staffing.repository;

import com.alveryn.api.staffing.entity.StaffingPlan;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffingPlanRepository extends JpaRepository<StaffingPlan, UUID> {
  Optional<StaffingPlan> findByOrganizationIdAndUnitIdAndWeekStart(
      UUID organizationId, UUID unitId, LocalDate weekStart);

  Optional<StaffingPlan> findByIdAndOrganizationIdAndUnitId(
      UUID id, UUID organizationId, UUID unitId);
}
