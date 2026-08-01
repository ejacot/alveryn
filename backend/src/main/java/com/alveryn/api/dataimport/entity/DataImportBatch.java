package com.alveryn.api.dataimport.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Entity
@Table(name = "data_import_batches")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DataImportBatch extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(name = "source_filename", nullable = false, length = 255)
  private String sourceFilename;

  @Column(name = "source_sha256", nullable = false, length = 64)
  private String sourceSha256;

  @Column(name = "source_size", nullable = false)
  private long sourceSize;

  @Column(name = "source_content_type", length = 100)
  private String sourceContentType;

  @Column(name = "source_content")
  private byte[] sourceContent;

  @Column(nullable = false, length = 20)
  private String format;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private DataImportStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "import_scope", nullable = false, length = 20)
  private DataImportScope importScope;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "employment_id")
  private Employment employment;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "workbook_data", nullable = false, columnDefinition = "jsonb")
  private JsonNode workbookData;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private JsonNode analysis;

  protected DataImportBatch(
      UserAccount user, String filename, String sha256, long size,
      String contentType, byte[] content, DataImportStatus status,
      DataImportScope importScope, Employment employment,
      JsonNode workbookData, JsonNode analysis) {
    this.user = user;
    this.sourceFilename = filename;
    this.sourceSha256 = sha256;
    this.sourceSize = size;
    this.sourceContentType = contentType;
    this.sourceContent = content;
    this.format = "XLSX";
    this.status = status;
    this.importScope = importScope;
    this.employment = employment;
    this.workbookData = workbookData;
    this.analysis = analysis;
  }

  public static DataImportBatch analyzed(
      UserAccount user, String filename, String sha256, long size,
      String contentType, byte[] content, DataImportStatus status,
      DataImportScope importScope, Employment employment,
      JsonNode workbookData, JsonNode analysis) {
    return new DataImportBatch(
        user, filename, sha256, size, contentType, content, status,
        importScope, employment, workbookData, analysis);
  }

  public void refreshAnalysis(
      DataImportStatus newStatus, JsonNode newWorkbookData, JsonNode newAnalysis) {
    status = newStatus;
    workbookData = newWorkbookData;
    analysis = newAnalysis;
  }

  public void markReady(JsonNode confirmedAnalysis) {
    status = DataImportStatus.READY;
    analysis = confirmedAnalysis;
  }

  public void updateAnalysis(JsonNode updatedAnalysis) {
    analysis = updatedAnalysis;
  }

  public void markImported() {
    status = DataImportStatus.IMPORTED;
  }
}
