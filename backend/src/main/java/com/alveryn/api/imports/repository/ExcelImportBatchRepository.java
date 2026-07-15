package com.alveryn.api.imports.repository;

import com.alveryn.api.imports.entity.ExcelImportBatch;
import com.alveryn.api.imports.entity.ExcelImportBatchStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ExcelImportBatchRepository extends JpaRepository<ExcelImportBatch, UUID> {
  boolean existsByUserIdAndFileSha256(UUID userId, String fileSha256);

  Optional<ExcelImportBatch> findByUserIdAndFileSha256(UUID userId, String fileSha256);

  Optional<ExcelImportBatch> findByIdAndUserId(UUID id, UUID userId);

  List<ExcelImportBatch> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

  Optional<ExcelImportBatch> findByUserIdAndPreviewTokenHashAndStatus(
      UUID userId, String previewTokenHash, ExcelImportBatchStatus status);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
      select batch
      from ExcelImportBatch batch
      where batch.user.id = :userId
        and batch.previewTokenHash = :previewTokenHash
        and batch.status = :status
      """)
  Optional<ExcelImportBatch> findClaimablePreviewForUpdate(
      UUID userId, String previewTokenHash, ExcelImportBatchStatus status);

  @Query(
      """
      select case when count(batch) > 0 then true else false end
      from ExcelImportBatch batch
      where batch.user.id = :userId
        and batch.fileSha256 = :fileSha256
        and batch.status = com.alveryn.api.imports.entity.ExcelImportBatchStatus.COMPLETED
      """)
  boolean existsCompletedByUserIdAndFileSha256(UUID userId, String fileSha256);
}
