package com.alveryn.api.schedule.repository;

import com.alveryn.api.schedule.entity.ScheduleTemplateRule;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleTemplateRuleRepository extends JpaRepository<ScheduleTemplateRule, UUID> {
  List<ScheduleTemplateRule> findAllByTemplateIdOrderByDayOfWeekAscStartLocalTimeAsc(UUID templateId);
}
