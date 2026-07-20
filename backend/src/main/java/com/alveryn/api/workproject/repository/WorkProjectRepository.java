package com.alveryn.api.workproject.repository;

import com.alveryn.api.workproject.entity.WorkProject;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkProjectRepository extends JpaRepository<WorkProject, UUID> {
  Optional<WorkProject> findByIdAndUserId(UUID id, UUID userId);
  List<WorkProject> findAllByUserIdOrderByStartDateDescCreatedAtDesc(UUID userId);
}
