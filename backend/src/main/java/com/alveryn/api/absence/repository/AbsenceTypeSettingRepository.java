package com.alveryn.api.absence.repository;

import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AbsenceTypeSettingRepository extends JpaRepository<AbsenceTypeSetting, UUID> {
  Optional<AbsenceTypeSetting> findByUserIdAndCode(UUID userId, AbsenceType code);
  Optional<AbsenceTypeSetting> findByUserIdAndNormalizedName(UUID userId, String normalizedName);
  List<AbsenceTypeSetting> findAllByUserIdOrderByDisplayOrderAscNameAsc(UUID userId);

  List<AbsenceTypeSetting> findAllByUserIdAndActiveTrueOrderByDisplayOrderAscNameAsc(UUID userId);

  Optional<AbsenceTypeSetting> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndNormalizedNameAndIdNot(UUID userId, String normalizedName, UUID id);

  boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);
}
