package com.alveryn.api.worksession.repository;

import com.alveryn.api.worksession.entity.WorkSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkSessionRepository extends JpaRepository<WorkSession, UUID> {
  Optional<WorkSession> findFirstByUserIdAndCheckedOutAtIsNull(UUID userId);
}
