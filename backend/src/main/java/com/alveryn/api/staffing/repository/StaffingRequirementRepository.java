package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingRequirement;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingRequirementRepository extends JpaRepository<StaffingRequirement, UUID> {
  List<StaffingRequirement> findAllByOrganizationIdAndDateBetweenOrderByDateAscStartTimeAsc(UUID organizationId, LocalDate from, LocalDate to);
  Optional<StaffingRequirement> findByIdAndOrganizationId(UUID id, UUID organizationId);
}
