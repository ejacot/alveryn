package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingAssignment;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface StaffingAssignmentRepository extends JpaRepository<StaffingAssignment, UUID> {
  List<StaffingAssignment> findAllByRequirementIdAndStatusOrderByCreatedAtAsc(UUID requirementId, String status);
  List<StaffingAssignment> findAllByMembershipIdAndStatusAndRequirementDate(UUID membershipId, String status, java.time.LocalDate date);
  Optional<StaffingAssignment> findByIdAndRequirementId(UUID id, UUID requirementId);
  @Query("""
      select assignment from StaffingAssignment assignment
      join fetch assignment.requirement requirement
      join fetch requirement.organization
      join fetch requirement.unit
      join fetch requirement.workType
      join fetch assignment.membership membership
      left join fetch membership.user
      where requirement.id in :requirementIds and assignment.status = 'ASSIGNED'
      order by assignment.createdAt asc, assignment.id asc
      """)
  List<StaffingAssignment> findAssignedForRequirements(
      @Param("requirementIds") Collection<UUID> requirementIds);
  @Query("""
      select assignment from StaffingAssignment assignment
      join fetch assignment.requirement requirement
      join fetch requirement.unit
      join fetch requirement.workType
      where assignment.membership.id = :membershipId
        and assignment.status = 'ASSIGNED'
        and requirement.publicationStatus = 'PUBLISHED'
        and requirement.date between :from and :to
      order by requirement.date asc, requirement.startTime asc, assignment.createdAt asc
      """)
  List<StaffingAssignment> findPublishedForMembership(
      @Param("membershipId") UUID membershipId,
      @Param("from") java.time.LocalDate from,
      @Param("to") java.time.LocalDate to);
}
