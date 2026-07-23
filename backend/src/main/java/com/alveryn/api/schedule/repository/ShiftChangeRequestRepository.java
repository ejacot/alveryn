package com.alveryn.api.schedule.repository;
import com.alveryn.api.schedule.entity.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ShiftChangeRequestRepository extends JpaRepository<ShiftChangeRequest,UUID> {
  @Query("""
    select r from ShiftChangeRequest r join fetch r.assignment a join fetch a.shift s join fetch a.worker
    where s.organization.id=:organizationId order by r.createdAt desc
    """)
  List<ShiftChangeRequest> findOrganization(@Param("organizationId") UUID organizationId);
  @Query("""
    select r from ShiftChangeRequest r join fetch r.assignment a join fetch a.shift s
    where r.id=:id and s.organization.id=:organizationId
    """)
  Optional<ShiftChangeRequest> findOwned(@Param("id") UUID id,@Param("organizationId") UUID organizationId);
  boolean existsByAssignmentIdAndStatus(UUID assignmentId, ShiftChangeRequestStatus status);
}
