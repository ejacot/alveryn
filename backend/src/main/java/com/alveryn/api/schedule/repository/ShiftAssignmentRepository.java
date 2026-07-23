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
}
