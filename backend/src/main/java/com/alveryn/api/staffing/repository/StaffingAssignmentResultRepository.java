package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingAssignmentResult;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface StaffingAssignmentResultRepository extends JpaRepository<StaffingAssignmentResult, UUID> {
  Optional<StaffingAssignmentResult> findByAssignmentId(UUID assignmentId);
  List<StaffingAssignmentResult> findAllByAssignmentRequirementOrganizationIdAndApprovalStatusOrderBySubmittedAtAsc(UUID organizationId, String status);
  @Query("""
      select result from StaffingAssignmentResult result
      join fetch result.assignment assignment
      join fetch assignment.membership membership
      left join fetch membership.user
      join fetch assignment.requirement requirement
      join fetch requirement.organization
      join fetch requirement.unit
      join fetch requirement.workType
      where assignment.id in :assignmentIds
      """)
  List<StaffingAssignmentResult> findAllForAssignments(
      @Param("assignmentIds") Collection<UUID> assignmentIds);
}
