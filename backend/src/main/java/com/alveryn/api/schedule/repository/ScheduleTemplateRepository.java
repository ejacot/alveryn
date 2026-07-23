package com.alveryn.api.schedule.repository;

import com.alveryn.api.schedule.entity.ScheduleTemplate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleTemplateRepository extends JpaRepository<ScheduleTemplate, UUID> {
  Optional<ScheduleTemplate> findFirstByEmploymentIdAndStatusOrderByVersionDesc(
      UUID employmentId, com.alveryn.api.schedule.entity.ScheduleTemplateStatus status);
  Optional<ScheduleTemplate> findFirstByEmploymentIdOrderByVersionDesc(UUID employmentId);
}
