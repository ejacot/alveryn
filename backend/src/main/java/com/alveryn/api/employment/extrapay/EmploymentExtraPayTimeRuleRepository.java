package com.alveryn.api.employment.extrapay;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmploymentExtraPayTimeRuleRepository extends JpaRepository<EmploymentExtraPayTimeRule, UUID> {
  List<EmploymentExtraPayTimeRule> findAllByEmploymentIdOrderByStartTime(UUID employmentId);
  java.util.Optional<EmploymentExtraPayTimeRule> findByIdAndEmploymentId(UUID id, UUID employmentId);
}
