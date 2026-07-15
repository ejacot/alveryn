package com.alveryn.api.worktype.repository;

import com.alveryn.api.worktype.entity.UnitType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UnitTypeRepository extends JpaRepository<UnitType, UUID> {
  List<UnitType> findAllByWorkTypeIdOrderByDisplayOrderAscNameAsc(UUID workTypeId);

  java.util.Optional<UnitType> findByIdAndWorkTypeUserId(UUID id, UUID userId);

  java.util.Optional<UnitType> findByIdAndWorkTypeIdAndWorkTypeUserId(
      UUID id, UUID workTypeId, UUID userId);

  boolean existsByWorkTypeIdAndNormalizedName(UUID workTypeId, String normalizedName);

  boolean existsByWorkTypeIdAndNormalizedNameAndIdNot(
      UUID workTypeId, String normalizedName, UUID id);

  boolean existsByWorkTypeId(UUID workTypeId);

  @Query("select coalesce(max(u.displayOrder), -1) from UnitType u where u.workType.id = :workTypeId")
  int findMaxDisplayOrderByWorkTypeId(UUID workTypeId);
}
