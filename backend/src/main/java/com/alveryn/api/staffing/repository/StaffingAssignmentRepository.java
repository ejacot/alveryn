package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingAssignment;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingAssignmentRepository extends JpaRepository<StaffingAssignment, UUID> {
  List<StaffingAssignment> findAllByRequirementIdAndStatusOrderByCreatedAtAsc(UUID requirementId, String status);
  List<StaffingAssignment> findAllByMembershipIdAndStatusAndRequirementDate(UUID membershipId, String status, java.time.LocalDate date);
  Optional<StaffingAssignment> findByIdAndRequirementId(UUID id, UUID requirementId);
}
