package com.roomly.api.worktype.repository;

import com.roomly.api.worktype.entity.WorkType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WorkTypeRepository extends JpaRepository<WorkType, UUID> {
  List<WorkType> findAllByUserIdOrderByDisplayOrderAscNameAsc(UUID userId);

  Optional<WorkType> findByIdAndUserId(UUID id, UUID userId);

  Optional<WorkType> findByUserIdAndNormalizedName(UUID userId, String normalizedName);

  boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);

  boolean existsByUserIdAndNormalizedNameAndIdNot(UUID userId, String normalizedName, UUID id);

  boolean existsByUserIdAndActiveTrue(UUID userId);

  @Query("select coalesce(max(w.displayOrder), -1) from WorkType w where w.user.id = :userId")
  int findMaxDisplayOrderByUserId(UUID userId);
}
