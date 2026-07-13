package com.roomly.api.imports.service;

import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.imports.config.ExcelImportProperties;
import com.roomly.api.imports.model.ExcelImportErrorCode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.openxml4j.exceptions.NotOfficeXmlFileException;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ExcelWorkbookValidator {
  private static final String XLSX_CONTENT_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  private final ExcelImportProperties properties;

  public ExcelWorkbookValidator(ExcelImportProperties properties) {
    this.properties = properties;
  }

  public ValidatedWorkbook validate(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ValidationException(
          "An .xlsx file is required", ExcelImportErrorCode.EXCEL_FILE_REQUIRED.name());
    }

    String fileName = normalizeFileName(file.getOriginalFilename());
    if (!fileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
      throw new ValidationException(
          "Only .xlsx workbooks are supported", ExcelImportErrorCode.EXCEL_INVALID_TYPE.name());
    }
    if (file.getSize() > properties.getMaxFileSizeBytes()) {
      throw new ValidationException(
          "The workbook exceeds the maximum supported size",
          ExcelImportErrorCode.EXCEL_FILE_TOO_LARGE.name());
    }

    byte[] bytes = readBytes(file);
    if (bytes.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B) {
      throw new ValidationException(
          "The uploaded file is not a valid .xlsx workbook",
          ExcelImportErrorCode.EXCEL_INVALID_TYPE.name());
    }
    if (file.getContentType() != null
        && !file.getContentType().isBlank()
        && !XLSX_CONTENT_TYPE.equalsIgnoreCase(file.getContentType())
        && !"application/octet-stream".equalsIgnoreCase(file.getContentType())) {
      throw new ValidationException(
          "The uploaded file is not a supported Excel workbook",
          ExcelImportErrorCode.EXCEL_INVALID_TYPE.name());
    }

    try {
      Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes));
      if (workbook.getNumberOfSheets() == 0) {
        workbook.close();
        throw new ValidationException(
            "The workbook does not contain any sheets",
            ExcelImportErrorCode.EXCEL_NO_SUPPORTED_SHEETS.name());
      }
      if (workbook.getNumberOfSheets() > properties.getMaxSheets()) {
        workbook.close();
        throw new ValidationException(
            "The workbook contains too many sheets", ExcelImportErrorCode.EXCEL_CORRUPTED.name());
      }
      FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
      return new ValidatedWorkbook(fileName, bytes.length, sha256(bytes), workbook, evaluator);
    } catch (EncryptedDocumentException ex) {
      throw new ValidationException(
          "Encrypted workbooks are not supported", ExcelImportErrorCode.EXCEL_ENCRYPTED.name());
    } catch (NotOfficeXmlFileException ex) {
      throw new ValidationException(
          "The uploaded file is not a valid .xlsx workbook",
          ExcelImportErrorCode.EXCEL_INVALID_TYPE.name());
    } catch (IOException | RuntimeException ex) {
      throw new ValidationException(
          "The workbook could not be read", ExcelImportErrorCode.EXCEL_CORRUPTED.name());
    }
  }

  private String normalizeFileName(String originalFilename) {
    String fallback = "schedule.xlsx";
    String fileName = originalFilename == null ? fallback : originalFilename.trim();
    if (fileName.isBlank() || fileName.length() > properties.getMaxFilenameLength()) {
      throw new ValidationException(
          "The workbook name is invalid", ExcelImportErrorCode.EXCEL_INVALID_TYPE.name());
    }
    return fileName;
  }

  private byte[] readBytes(MultipartFile file) {
    try (InputStream inputStream = file.getInputStream()) {
      return inputStream.readAllBytes();
    } catch (IOException ex) {
      throw new ValidationException(
          "The workbook could not be read", ExcelImportErrorCode.EXCEL_CORRUPTED.name());
    }
  }

  private String sha256(byte[] bytes) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(bytes));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }

  public record ValidatedWorkbook(
      String fileName,
      long fileSizeBytes,
      String fileSha256,
      Workbook workbook,
      FormulaEvaluator evaluator) implements AutoCloseable {
    @Override
    public void close() throws Exception {
      workbook.close();
    }
  }
}
