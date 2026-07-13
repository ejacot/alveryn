package com.roomly.api.imports.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.worktype.entity.WorkType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "excel_import_batches")
public class ExcelImportBatch extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(name = "file_name", nullable = false, length = 255)
  private String fileName;

  @JdbcTypeCode(SqlTypes.CHAR)
  @Column(name = "file_sha256", nullable = false, length = 64)
  private String fileSha256;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private ExcelImportBatchStatus status;

  @Column(name = "detected_year", nullable = false)
  private int detectedYear;

  @Column(name = "recognized_sheets_count", nullable = false)
  private int recognizedSheetsCount;

  @Column(name = "imported_entries_count", nullable = false)
  private int importedEntriesCount;

  @Column(name = "imported_absences_count", nullable = false)
  private int importedAbsencesCount;

  @Column(name = "skipped_rows_count", nullable = false)
  private int skippedRowsCount;

  @Column(name = "warning_count", nullable = false)
  private int warningCount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "imported_work_type_id")
  private WorkType importedWorkType;

  @Column(name = "file_size_bytes", nullable = false)
  private long fileSizeBytes;

  @Column(name = "confirmed_at")
  private OffsetDateTime confirmedAt;

  @Column(name = "undone_at")
  private OffsetDateTime undoneAt;

  @Column(name = "previewed_at")
  private OffsetDateTime previewedAt;

  @Column(name = "preview_expires_at")
  private OffsetDateTime previewExpiresAt;

  @JdbcTypeCode(SqlTypes.CHAR)
  @Column(name = "preview_token_hash", length = 64)
  private String previewTokenHash;

  @Column(name = "preview_payload_json")
  private String previewPayloadJson;

  @Column(name = "created_fallback_work_type", nullable = false)
  private boolean createdFallbackWorkType;

  public ExcelImportBatch(
      UserAccount user,
      String fileName,
      String fileSha256,
      long fileSizeBytes,
      int detectedYear) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.fileName = requireText(fileName, "fileName is required", 255);
    this.fileSha256 = requireText(fileSha256, "fileSha256 is required", 64);
    if (detectedYear < 1900) {
      throw new IllegalArgumentException("detectedYear is invalid");
    }
    if (fileSizeBytes < 0) {
      throw new IllegalArgumentException("fileSizeBytes must be non-negative");
    }
    this.status = ExcelImportBatchStatus.PREVIEWED;
    this.detectedYear = detectedYear;
    this.fileSizeBytes = fileSizeBytes;
  }

  public void markPreviewed(
      int recognizedSheetsCount,
      int importedEntriesCount,
      int importedAbsencesCount,
      int skippedRowsCount,
      int warningCount,
      OffsetDateTime previewedAt,
      OffsetDateTime previewExpiresAt,
      String previewTokenHash,
      String previewPayloadJson) {
    validateCounts(recognizedSheetsCount, importedEntriesCount, importedAbsencesCount, skippedRowsCount, warningCount);
    this.status = ExcelImportBatchStatus.PREVIEWED;
    this.recognizedSheetsCount = recognizedSheetsCount;
    this.importedEntriesCount = importedEntriesCount;
    this.importedAbsencesCount = importedAbsencesCount;
    this.skippedRowsCount = skippedRowsCount;
    this.warningCount = warningCount;
    this.previewedAt = Objects.requireNonNull(previewedAt, "previewedAt is required");
    this.previewExpiresAt = Objects.requireNonNull(previewExpiresAt, "previewExpiresAt is required");
    this.previewTokenHash = requireText(previewTokenHash, "previewTokenHash is required", 64);
    this.previewPayloadJson = Objects.requireNonNull(previewPayloadJson, "previewPayloadJson is required");
  }

  public void markCompleted(
      WorkType importedWorkType,
      boolean createdFallbackWorkType,
      int importedEntriesCount,
      int importedAbsencesCount,
      int skippedRowsCount,
      int warningCount,
      OffsetDateTime confirmedAt) {
    validateCounts(this.recognizedSheetsCount, importedEntriesCount, importedAbsencesCount, skippedRowsCount, warningCount);
    this.status = ExcelImportBatchStatus.COMPLETED;
    this.importedWorkType = importedWorkType;
    this.createdFallbackWorkType = createdFallbackWorkType;
    this.importedEntriesCount = importedEntriesCount;
    this.importedAbsencesCount = importedAbsencesCount;
    this.skippedRowsCount = skippedRowsCount;
    this.warningCount = warningCount;
    this.confirmedAt = Objects.requireNonNull(confirmedAt, "confirmedAt is required");
    clearPreviewTokenState();
  }

  public void markUndone(OffsetDateTime undoneAt) {
    this.status = ExcelImportBatchStatus.UNDONE;
    this.undoneAt = Objects.requireNonNull(undoneAt, "undoneAt is required");
    clearPreviewTokenState();
  }

  public void markFailed() {
    this.status = ExcelImportBatchStatus.FAILED;
    clearPreviewTokenState();
  }

  public boolean isPreviewExpired(OffsetDateTime now) {
    return previewExpiresAt == null || !previewExpiresAt.isAfter(now);
  }

  private void clearPreviewTokenState() {
    previewTokenHash = null;
    previewExpiresAt = null;
  }

  private static void validateCounts(
      int recognizedSheetsCount,
      int importedEntriesCount,
      int importedAbsencesCount,
      int skippedRowsCount,
      int warningCount) {
    if (recognizedSheetsCount < 0
        || importedEntriesCount < 0
        || importedAbsencesCount < 0
        || skippedRowsCount < 0
        || warningCount < 0) {
      throw new IllegalArgumentException("import counts must be non-negative");
    }
  }

  private static String requireText(String value, String message, int maxLength) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(message);
    }
    String trimmed = value.trim();
    if (trimmed.length() > maxLength) {
      throw new IllegalArgumentException(message);
    }
    return trimmed;
  }
}
