package com.alveryn.api.dataimport.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PayrollDocumentAnalyzerTest {

  @Test
  void analyzesSinglePageScannedPdfWithoutSearchableMonthText() throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    ImportIntelligenceService intelligence = mock(ImportIntelligenceService.class);
    ObjectNode result = objectMapper.createObjectNode()
        .put("status", "COMPLETED")
        .put("year", 2026)
        .put("month", 6)
        .put("normalHours", 160);
    when(intelligence.analyzeMonthlyPayrollImages(anyList(), eq(2026), eq(6)))
        .thenReturn(result);

    byte[] pdfBytes;
    try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      pdf.addPage(new PDPage());
      pdf.save(output);
      pdfBytes = output.toByteArray();
    }

    var file = new MockMultipartFile(
        "file", "scan.pdf", "application/pdf", pdfBytes);
    ObjectNode analysis = new PayrollDocumentAnalyzer(objectMapper, intelligence)
        .analyzeMonthly(file, 2026, 6);

    assertThat(analysis.path("normalHours").asInt()).isEqualTo(160);
    assertThat(analysis.path("filename").asText()).isEqualTo("scan.pdf");
  }
}
