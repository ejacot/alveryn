package com.roomly.api.worktype.repository;

import com.roomly.api.worktype.entity.WorkType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkTypeRepository extends JpaRepository<WorkType, UUID> {
  List<WorkType> findAllByUserIdAndActiveTrueOrderByDisplayOrder(UUID userId);

  Optional<WorkType> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);
}
