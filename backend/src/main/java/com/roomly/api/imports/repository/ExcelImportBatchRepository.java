package com.roomly.api.imports.repository;

import com.roomly.api.imports.entity.ExcelImportBatch;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExcelImportBatchRepository extends JpaRepository<ExcelImportBatch, UUID> {
  boolean existsByUserIdAndFileSha256(UUID userId, String fileSha256);
}
