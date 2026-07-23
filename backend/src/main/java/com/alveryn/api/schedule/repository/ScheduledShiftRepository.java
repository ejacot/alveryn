package com.alveryn.api.schedule.repository;

import com.alveryn.api.schedule.entity.ScheduledShift;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ScheduledShiftRepository extends JpaRepository<ScheduledShift, UUID> {
  boolean existsByTemplateRuleIdAndTemplateOccurrenceDate(UUID templateRuleId, LocalDate occurrenceDate);

  @Modifying
  @Query(value = """
      DELETE FROM scheduled_shifts s
      WHERE s.id IN (
        SELECT a.shift_id
        FROM shift_assignments a
        WHERE a.employment_id = :employmentId
      )
      AND s.shift_source = 'RECURRING_TEMPLATE'
      AND s.manually_overridden = FALSE
      AND s.starts_at >= :from
      """, nativeQuery = true)
  void deleteGeneratedFuture(@Param("employmentId") UUID employmentId, @Param("from") OffsetDateTime from);
}
