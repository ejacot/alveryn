package com.alveryn.api.worktype.repository;

import com.alveryn.api.worktype.entity.WorkType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WorkTypeRepository extends JpaRepository<WorkType, UUID> {
  List<WorkType> findAllByUserIdOrderByDisplayOrderAscNameAsc(UUID userId);

  Optional<WorkType> findByIdAndUserId(UUID id, UUID userId);

  List<WorkType> findAllByParentIdAndUserIdOrderByDisplayOrderAscNameAsc(UUID parentId, UUID userId);

  List<WorkType> findAllByUserIdAndParentIdIn(UUID userId, Collection<UUID> parentIds);

  boolean existsByParentId(UUID parentId);

  Optional<WorkType> findByUserIdAndNormalizedName(UUID userId, String normalizedName);

  boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);

  boolean existsByUserIdAndNormalizedNameAndIdNot(UUID userId, String normalizedName, UUID id);

  boolean existsByUserIdAndParentIsNullAndNormalizedName(UUID userId, String normalizedName);

  boolean existsByUserIdAndParentIsNullAndNormalizedNameAndIdNot(UUID userId, String normalizedName, UUID id);

  boolean existsByUserIdAndParentIdAndNormalizedName(UUID userId, UUID parentId, String normalizedName);

  boolean existsByUserIdAndParentIdAndNormalizedNameAndIdNot(
      UUID userId, UUID parentId, String normalizedName, UUID id);

  boolean existsByUserIdAndActiveTrue(UUID userId);

  @Query("select coalesce(max(w.displayOrder), -1) from WorkType w where w.user.id = :userId")
  int findMaxDisplayOrderByUserId(UUID userId);
}
