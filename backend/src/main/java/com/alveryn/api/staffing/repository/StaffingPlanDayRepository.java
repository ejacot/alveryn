package com.alveryn.api.staffing.repository;

import com.alveryn.api.staffing.entity.StaffingPlanDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffingPlanDayRepository extends JpaRepository<StaffingPlanDay, UUID> {
  Optional<StaffingPlanDay> findByPlanIdAndOrganizationIdAndDate(
      UUID planId, UUID organizationId, LocalDate date);

  List<StaffingPlanDay> findAllByPlanIdAndOrganizationIdOrderByDateAsc(
      UUID planId, UUID organizationId);
}
