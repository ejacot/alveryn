package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingAssignmentResult;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingAssignmentResultRepository extends JpaRepository<StaffingAssignmentResult, UUID> {
  Optional<StaffingAssignmentResult> findByAssignmentId(UUID assignmentId);
  List<StaffingAssignmentResult> findAllByAssignmentRequirementOrganizationIdAndApprovalStatusOrderBySubmittedAtAsc(UUID organizationId, String status);
}
