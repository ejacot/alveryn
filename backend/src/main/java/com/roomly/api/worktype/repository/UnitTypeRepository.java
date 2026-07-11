package com.roomly.api.worktype.repository;

import com.roomly.api.worktype.entity.UnitType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnitTypeRepository extends JpaRepository<UnitType, UUID> {
  List<UnitType> findAllByWorkTypeIdAndActiveTrueOrderByDisplayOrder(UUID workTypeId);
}
