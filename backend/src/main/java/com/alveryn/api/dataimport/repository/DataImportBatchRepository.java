package com.alveryn.api.dataimport.repository;

import com.alveryn.api.dataimport.entity.DataImportBatch;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DataImportBatchRepository extends JpaRepository<DataImportBatch, UUID> {
  Optional<DataImportBatch> findByUserIdAndSourceSha256(UUID userId, String sourceSha256);
  Optional<DataImportBatch> findByIdAndUserId(UUID id, UUID userId);
}
