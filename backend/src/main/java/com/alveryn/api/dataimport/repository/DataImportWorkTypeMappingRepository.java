package com.alveryn.api.dataimport.repository;

import com.alveryn.api.dataimport.entity.DataImportWorkTypeMapping;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DataImportWorkTypeMappingRepository
    extends JpaRepository<DataImportWorkTypeMapping, UUID> {
  List<DataImportWorkTypeMapping> findAllByUserIdAndEmploymentId(UUID userId, UUID employmentId);
  Optional<DataImportWorkTypeMapping>
      findByUserIdAndEmploymentIdAndNormalizedSourceLabel(
          UUID userId, UUID employmentId, String normalizedSourceLabel);
}
