package com.alveryn.api.dataimport.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.dataimport.dto.DataImportAnalysisResponse;
import com.alveryn.api.dataimport.dto.DataImportConfirmRequest;
import com.alveryn.api.dataimport.dto.DataImportConfirmResponse;
import com.alveryn.api.dataimport.dto.DataImportPreviewResponse;
import com.alveryn.api.dataimport.dto.DataImportExecuteRequest;
import com.alveryn.api.dataimport.dto.DataImportExecuteResponse;
import com.alveryn.api.dataimport.dto.DataImportChatRequest;
import com.alveryn.api.dataimport.dto.DataImportChatResponse;
import com.alveryn.api.dataimport.dto.DataImportPeriodRequest;
import com.alveryn.api.dataimport.entity.DataImportScope;
import com.alveryn.api.dataimport.service.DataImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ContentDisposition;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/data-imports")
@RequiredArgsConstructor
public class DataImportController {
  private final DataImportService service;
  private final com.alveryn.api.dataimport.service.DataImportEntryService entryService;
  private final com.alveryn.api.dataimport.service.PayrollDocumentAnalyzer payrollAnalyzer;
  private final com.alveryn.api.dataimport.service.PayrollReconciliationService payrollReconciliations;

  @PostMapping(path = "/payroll-reconciliation", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<com.alveryn.api.dataimport.dto.PayrollReconciliationResponse> reconcilePayroll(
      @RequestPart("file") MultipartFile file,
      @RequestParam int year,
      @RequestParam int month) {
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      throw new IllegalArgumentException("Invalid reconciliation period");
    }
    return ApiResponse.of(com.alveryn.api.dataimport.dto.PayrollReconciliationResponse.from(
        payrollAnalyzer.analyzeMonthly(file, year, month)));
  }

  @PostMapping("/payroll-reconciliations")
  public ApiResponse<com.alveryn.api.dataimport.dto.SavedPayrollReconciliationResponse> savePayroll(
      @Valid @RequestBody com.alveryn.api.dataimport.dto.SavePayrollReconciliationRequest request) {
    return ApiResponse.of(payrollReconciliations.save(request));
  }

  @GetMapping("/payroll-reconciliations")
  public ApiResponse<com.alveryn.api.dataimport.dto.PayrollReconciliationDetailResponse> getPayroll(
      @RequestParam java.util.UUID employmentId,
      @RequestParam int year,
      @RequestParam int month) {
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      throw new IllegalArgumentException("Invalid reconciliation period");
    }
    return ApiResponse.of(payrollReconciliations.find(employmentId, year, month));
  }

  @PutMapping(path = "/payroll-reconciliations/{reconciliationId}/document",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<Void> savePayrollDocument(
      @PathVariable java.util.UUID reconciliationId,
      @RequestPart("file") MultipartFile file) {
    payrollReconciliations.saveDocument(reconciliationId, file);
    return ApiResponse.of(null);
  }

  @GetMapping("/payroll-reconciliations/{reconciliationId}/document")
  public ResponseEntity<byte[]> getPayrollDocument(
      @PathVariable java.util.UUID reconciliationId) {
    var document = payrollReconciliations.document(reconciliationId);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(document.contentType()))
        .contentLength(document.content().length)
        .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
            .filename(document.filename(), StandardCharsets.UTF_8).build().toString())
        .header("X-Content-Type-Options", "nosniff")
        .body(document.content());
  }

  @PostMapping(path = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<DataImportAnalysisResponse> analyze(
      @RequestPart("file") MultipartFile file,
      @RequestPart(value = "payrollFiles", required = false) java.util.List<MultipartFile> payrollFiles,
      @RequestParam DataImportScope scope,
      @RequestParam(required = false) java.util.UUID employmentId) {
    return ApiResponse.of(service.analyze(file, payrollFiles, scope, employmentId));
  }

  @PostMapping("/{batchId}/confirm")
  public ApiResponse<DataImportConfirmResponse> confirm(
      @PathVariable java.util.UUID batchId,
      @Valid @RequestBody DataImportConfirmRequest request) {
    return ApiResponse.of(service.confirm(batchId, request));
  }

  @GetMapping("/{batchId}/preview")
  public ApiResponse<DataImportPreviewResponse> preview(
      @PathVariable java.util.UUID batchId) {
    return ApiResponse.of(entryService.preview(batchId));
  }

  @PostMapping("/{batchId}/questions/chat")
  public ApiResponse<DataImportChatResponse> chat(
      @PathVariable java.util.UUID batchId,
      @Valid @RequestBody DataImportChatRequest request) {
    return ApiResponse.of(entryService.chat(batchId, request));
  }

  @PutMapping("/{batchId}/period")
  public ApiResponse<DataImportAnalysisResponse> period(
      @PathVariable java.util.UUID batchId,
      @Valid @RequestBody DataImportPeriodRequest request) {
    return ApiResponse.of(service.setPeriod(batchId, request));
  }

  @PostMapping("/{batchId}/import")
  public ApiResponse<DataImportExecuteResponse> execute(
      @PathVariable java.util.UUID batchId,
      @Valid @RequestBody DataImportExecuteRequest request) {
    return ApiResponse.of(entryService.execute(batchId, request));
  }
}
