package com.roomly.api.imports.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.user.entity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

  @Column(name = "file_sha256", nullable = false, length = 64)
  private String fileSha256;

  @Column(name = "detected_year", nullable = false)
  private int detectedYear;

  @Column(name = "imported_entries_count", nullable = false)
  private int importedEntriesCount;

  @Column(name = "imported_absences_count", nullable = false)
  private int importedAbsencesCount;

  public ExcelImportBatch(
      UserAccount user,
      String fileName,
      String fileSha256,
      int detectedYear,
      int importedEntriesCount,
      int importedAbsencesCount) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.fileName = requireText(fileName, "fileName is required", 255);
    this.fileSha256 = requireText(fileSha256, "fileSha256 is required", 64);
    if (detectedYear < 1900) {
      throw new IllegalArgumentException("detectedYear is invalid");
    }
    if (importedEntriesCount < 0 || importedAbsencesCount < 0) {
      throw new IllegalArgumentException("import counts must be non-negative");
    }
    this.detectedYear = detectedYear;
    this.importedEntriesCount = importedEntriesCount;
    this.importedAbsencesCount = importedAbsencesCount;
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
