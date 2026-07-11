package com.roomly.api.worktype.repository;

import com.roomly.api.worktype.entity.UnitType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnitTypeRepository extends JpaRepository<UnitType, UUID> {
  List<UnitType> findAllByWorkTypeIdAndActiveTrueOrderByDisplayOrder(UUID workTypeId);

  java.util.Optional<UnitType> findByIdAndWorkTypeUserId(UUID id, UUID userId);

  boolean existsByWorkTypeIdAndNormalizedName(UUID workTypeId, String normalizedName);

  boolean existsByWorkTypeIdAndNormalizedNameAndIdNot(
      UUID workTypeId, String normalizedName, UUID id);
}
