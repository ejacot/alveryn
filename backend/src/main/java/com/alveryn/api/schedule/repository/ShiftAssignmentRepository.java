package com.alveryn.api.schedule.repository;

import com.alveryn.api.schedule.entity.ShiftAssignment;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, UUID> {
  @Query("""
      select a from ShiftAssignment a
      join fetch a.shift s
      where a.id = :assignmentId
        and a.employment.user.id = :userId
      """)
  java.util.Optional<ShiftAssignment> findOwned(@Param("assignmentId") UUID assignmentId,
      @Param("userId") UUID userId);

  @Query("""
      select a from ShiftAssignment a
      join fetch a.shift s
      where a.employment.id = :employmentId
        and s.startsAt < :to
        and s.endsAt > :from
        and s.status <> com.alveryn.api.schedule.entity.ShiftStatus.CANCELLED
      order by s.startsAt
      """)
  List<ShiftAssignment> findRange(@Param("employmentId") UUID employmentId,
      @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

  @Query("""
      select a from ShiftAssignment a join fetch a.shift s join fetch a.worker w join fetch a.employment e
      where s.organization.id = :organizationId and s.startsAt < :to and s.endsAt > :from
      order by s.startsAt
      """)
  List<ShiftAssignment> findOrganizationRange(@Param("organizationId") UUID organizationId,
      @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

  @Query("""
      select count(a) > 0 from ShiftAssignment a join a.shift s
      where a.worker.id = :membershipId and s.status <> com.alveryn.api.schedule.entity.ShiftStatus.CANCELLED
        and s.startsAt < :end and s.endsAt > :start
      """)
  boolean hasOverlap(@Param("membershipId") UUID membershipId, @Param("start") OffsetDateTime start,
      @Param("end") OffsetDateTime end);

  @Query("""
      select count(a) > 0 from ShiftAssignment a join a.shift s
      where a.worker.id = :membershipId and a.id <> :assignmentId
        and s.status <> com.alveryn.api.schedule.entity.ShiftStatus.CANCELLED
        and s.startsAt < :end and s.endsAt > :start
      """)
  boolean hasOverlapExcluding(@Param("membershipId") UUID membershipId,
      @Param("assignmentId") UUID assignmentId, @Param("start") OffsetDateTime start,
      @Param("end") OffsetDateTime end);

  @Query("""
      select a from ShiftAssignment a join fetch a.shift s join fetch a.worker w join fetch a.employment e
      where a.id = :assignmentId and s.organization.id = :organizationId
      """)
  java.util.Optional<ShiftAssignment> findByIdAndOrganizationId(@Param("assignmentId") UUID assignmentId,
      @Param("organizationId") UUID organizationId);
}
