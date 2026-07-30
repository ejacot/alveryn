package com.alveryn.api.employment.extrapay;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmploymentExtraPayRuleRepository
    extends JpaRepository<EmploymentExtraPayRule, UUID> {
  List<EmploymentExtraPayRule> findAllByEmploymentIdOrderByWeekday(UUID employmentId);
  Optional<EmploymentExtraPayRule> findByEmploymentIdAndWeekday(
      UUID employmentId, DayOfWeek weekday);
}
