package com.alveryn.api.imports.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "alveryn.imports.excel")
public class ExcelImportProperties {

  @Min(1)
  private long maxFileSizeBytes = 10 * 1024 * 1024L;

  @Min(1)
  @Max(100)
  private int maxSheets = 24;

  @Min(1)
  @Max(10000)
  private int maxRowsPerSheet = 1000;

  @Min(1)
  @Max(50000)
  private int maxTotalRows = 12000;

  @Min(1)
  @Max(500)
  private int maxWarnings = 50;

  @Min(32)
  @Max(255)
  private int maxFilenameLength = 255;

  private Duration previewTokenLifetime = Duration.ofMinutes(15);

  public long getMaxFileSizeBytes() {
    return maxFileSizeBytes;
  }

  public void setMaxFileSizeBytes(long maxFileSizeBytes) {
    this.maxFileSizeBytes = maxFileSizeBytes;
  }

  public int getMaxSheets() {
    return maxSheets;
  }

  public void setMaxSheets(int maxSheets) {
    this.maxSheets = maxSheets;
  }

  public int getMaxRowsPerSheet() {
    return maxRowsPerSheet;
  }

  public void setMaxRowsPerSheet(int maxRowsPerSheet) {
    this.maxRowsPerSheet = maxRowsPerSheet;
  }

  public int getMaxTotalRows() {
    return maxTotalRows;
  }

  public void setMaxTotalRows(int maxTotalRows) {
    this.maxTotalRows = maxTotalRows;
  }

  public int getMaxWarnings() {
    return maxWarnings;
  }

  public void setMaxWarnings(int maxWarnings) {
    this.maxWarnings = maxWarnings;
  }

  public int getMaxFilenameLength() {
    return maxFilenameLength;
  }

  public void setMaxFilenameLength(int maxFilenameLength) {
    this.maxFilenameLength = maxFilenameLength;
  }

  public Duration getPreviewTokenLifetime() {
    return previewTokenLifetime;
  }

  public void setPreviewTokenLifetime(Duration previewTokenLifetime) {
    if (previewTokenLifetime == null
        || previewTokenLifetime.isZero()
        || previewTokenLifetime.isNegative()) {
      this.previewTokenLifetime = Duration.ofMinutes(15);
      return;
    }
    this.previewTokenLifetime = previewTokenLifetime;
  }
}
