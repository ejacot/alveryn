package com.alveryn.api.dataimport.service;
import com.alveryn.api.dataimport.dto.*;
import com.alveryn.api.dataimport.entity.PayrollReconciliation;
import com.alveryn.api.dataimport.repository.PayrollReconciliationRepository;
import com.alveryn.api.dataimport.repository.PayrollReconciliationDocumentRepository;
import com.alveryn.api.dataimport.entity.PayrollReconciliationDocument;
import com.alveryn.api.employment.service.EmploymentService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service @RequiredArgsConstructor
public class PayrollReconciliationService {
  private final EmploymentService employments;
  private final PayrollReconciliationRepository repository;
  private final PayrollReconciliationDocumentRepository documents;
  private final ObjectMapper mapper;

  @Transactional
  public SavedPayrollReconciliationResponse save(SavePayrollReconciliationRequest request) {
    var employment=employments.requireOwned(request.employmentId());
    var value=repository.findByEmploymentIdAndYearAndMonth(
        request.employmentId(), request.year(), request.month())
        .orElseGet(() -> new PayrollReconciliation(
            employment.getUser(), employment, request.year(), request.month()));
    try {
      value.update(request.filename(), request.appWorkedHours(), request.appAbsenceHours(),
          request.appExtraHours(), request.appGross(), request.payrollWorkedHours(),
          request.payrollAbsenceHours(), request.payrollExtraHours(), request.payrollGross(),
          mapper.writeValueAsString(request.payrollLines()), request.notes());
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not save payroll details", exception);
    }
    value=repository.save(value);
    return new SavedPayrollReconciliationResponse(value.getId(), value.getStatus(),
        difference(request.payrollWorkedHours(), request.appWorkedHours()),
        difference(request.payrollAbsenceHours(), request.appAbsenceHours()),
        difference(request.payrollExtraHours(), request.appExtraHours()),
        difference(request.payrollGross(), request.appGross()));
  }

  @Transactional(readOnly = true)
  public PayrollReconciliationDetailResponse find(UUID employmentId, int year, int month) {
    employments.requireOwned(employmentId);
    return repository.findByEmploymentIdAndYearAndMonth(employmentId, year, month)
        .map(this::toDetail)
        .orElse(null);
  }

  @Transactional
  public void saveDocument(UUID reconciliationId, MultipartFile file) {
    if (file == null || file.isEmpty() || file.getSize() > 15L * 1024 * 1024) {
      throw new IllegalArgumentException("Payroll document must be between 1 byte and 15 MB");
    }
    var reconciliation = repository.findById(reconciliationId)
        .orElseThrow(() -> new IllegalArgumentException("Payroll reconciliation was not found"));
    employments.requireOwned(reconciliation.getEmployment().getId());
    String filename = safeFilename(file.getOriginalFilename());
    String contentType = PayrollDocumentMediaType.detect(file);
    if (contentType == null) {
      throw new IllegalArgumentException("Unsupported payroll document type");
    }
    try {
      var document = documents.findByReconciliationId(reconciliationId)
          .orElseGet(() -> new PayrollReconciliationDocument(reconciliation));
      document.replace(filename, contentType, file.getBytes());
      documents.save(document);
    } catch (java.io.IOException exception) {
      throw new IllegalArgumentException("Could not store payroll document", exception);
    }
  }

  @Transactional(readOnly = true)
  public PayrollDocumentDownload document(UUID reconciliationId) {
    var reconciliation = repository.findById(reconciliationId)
        .orElseThrow(() -> new IllegalArgumentException("Payroll reconciliation was not found"));
    employments.requireOwned(reconciliation.getEmployment().getId());
    var document = documents.findByReconciliationId(reconciliationId)
        .orElseThrow(() -> new IllegalArgumentException("Payroll document was not found"));
    return new PayrollDocumentDownload(
        document.getFilename(), document.getContentType(), document.getContent());
  }

  private PayrollReconciliationDetailResponse toDetail(PayrollReconciliation value) {
    List<PayrollReconciliationResponse.PayrollLine> lines;
    try {
      lines = mapper.readValue(value.getPayrollLinesJson(), new TypeReference<>() {});
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not read saved payroll details", exception);
    }
    var document = documents.findMetadataByReconciliationId(value.getId()).orElse(null);
    return new PayrollReconciliationDetailResponse(
        value.getId(), value.getEmployment().getId(), value.getYear(), value.getMonth(),
        value.getFilename(), value.getStatus(), value.getAppWorkedHours(),
        value.getAppAbsenceHours(), value.getAppExtraHours(), value.getAppGross(),
        value.getPayrollWorkedHours(), value.getPayrollAbsenceHours(),
        value.getPayrollExtraHours(), value.getPayrollGross(), lines, value.getNotes(),
        document != null, document == null ? null : document.getFilename(),
        document == null ? null : document.getContentType(),
        document == null ? null : document.getContentSize(),
        difference(value.getPayrollWorkedHours(), value.getAppWorkedHours()),
        difference(value.getPayrollAbsenceHours(), value.getAppAbsenceHours()),
        difference(value.getPayrollExtraHours(), value.getAppExtraHours()),
        difference(value.getPayrollGross(), value.getAppGross()));
  }

  private BigDecimal difference(BigDecimal payroll, BigDecimal app) {
    return payroll == null || app == null ? null : payroll.subtract(app);
  }

  private String safeFilename(String filename) {
    String value = filename == null ? "lohn-document" : filename;
    value = value.replace('\\', '_').replace('/', '_').replaceAll("[\\r\\n\\u0000]", "_").trim();
    return value.isBlank() ? "lohn-document" : value.substring(0, Math.min(255, value.length()));
  }

  public record PayrollDocumentDownload(String filename, String contentType, byte[] content) {}
}
