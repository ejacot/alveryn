package com.alveryn.api.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.dataimport.service.XlsxWorkbookAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class XlsxWorkbookAnalyzerTest {
  private final XlsxWorkbookAnalyzer analyzer = new XlsxWorkbookAnalyzer(new ObjectMapper());

  @Test
  void preservesCellsAndTurnsNumericColumnsIntoReviewableCandidates() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Juli");
      sheet.createRow(0).createCell(0).setCellValue("Datum");
      sheet.getRow(0).createCell(1).setCellValue("CH");
      sheet.createRow(1).createCell(0).setCellValue("29.07.2026");
      sheet.getRow(1).createCell(1).setCellValue(7.5);
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var result = analyzer.analyze(workbookBytes);

    assertThat(result.requiresReview()).isTrue();
    assertThat(result.analysis().path("sheetCount").asInt()).isEqualTo(1);
    assertThat(result.analysis().path("workTypeCandidates").get(0).path("sourceLabel").asText())
        .isEqualTo("CH");
    assertThat(result.analysis().path("workTypeCandidates").get(0)
        .path("suggestedCalculationType").asText()).isEqualTo("TIME_BASED");
    assertThat(result.workbookData().path("sheets").get(0).path("rows")).hasSize(2);
  }

  @Test
  void rejectsNonXlsxContent() {
    assertThatThrownBy(() -> analyzer.analyze("not a workbook".getBytes()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("valid readable");
  }

  @Test
  void doesNotAssumeWholeNumbersAreUnitsWhenNoFormulaProvidesEvidence() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("January");
      sheet.createRow(0).createCell(1).setCellValue("HSK");
      sheet.createRow(1).createCell(1).setCellValue(8);
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedCalculationType").asText()).isEqualTo("UNKNOWN");
    assertThat(candidate.path("confidence").asDouble()).isEqualTo(0.35);
    assertThat(candidate.path("reason").asText()).contains("cannot safely distinguish");
  }

  @Test
  void proposesSurchargeLabelsAsExtraPayInsteadOfWorkTypes() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("January");
      sheet.createRow(0).createCell(1).setCellValue("Night surcharge");
      sheet.createRow(1).createCell(1).setCellValue(8);
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedAction").asText()).isEqualTo("CONFIGURE_SURCHARGE");
    assertThat(candidate.path("semanticRole").asText()).isEqualTo("SURCHARGE");
    assertThat(candidate.path("reason").asText()).contains("extra-pay rule");
  }

  @Test
  void classifiesTextMarkersUnderFreiAsRestDays() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("January");
      sheet.createRow(0).createCell(1).setCellValue("Frei");
      sheet.createRow(1).createCell(1).setCellValue("F");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedAction").asText()).isEqualTo("MARK_REST_DAY");
    assertThat(candidate.path("semanticRole").asText()).isEqualTo("REST_DAY");
    assertThat(candidate.path("occurrences").asInt()).isEqualTo(1);
  }

  @Test
  void classifiesSickLeaveColumnsAsAbsenceInsteadOfWork() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("January");
      sheet.createRow(0).createCell(1).setCellValue("Krank");
      sheet.createRow(1).createCell(1).setCellValue("X");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedAction").asText()).isEqualTo("IMPORT_AS_ABSENCE");
    assertThat(candidate.path("semanticRole").asText()).isEqualTo("ABSENCE");
  }

  @Test
  void asksAboutShortStatusCodesInsideMixedActivityColumns() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("February");
      sheet.createRow(0).createCell(9).setCellValue("Public");
      var worked = sheet.createRow(1);
      worked.createCell(0).setCellValue(1);
      worked.createCell(9).setCellValue(8);
      var vacation = sheet.createRow(2);
      vacation.createCell(0).setCellValue(2);
      vacation.createCell(9).setCellValue("U");
      var free = sheet.createRow(3);
      free.createCell(0).setCellValue(3);
      free.createCell(9).setCellValue("F");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidates = analyzer.analyze(workbookBytes).analysis().path("workTypeCandidates");
    var vacation = java.util.stream.StreamSupport.stream(candidates.spliterator(), false)
        .filter(candidate -> "U".equals(candidate.path("sourceLabel").asText()))
        .findFirst().orElseThrow();
    var free = java.util.stream.StreamSupport.stream(candidates.spliterator(), false)
        .filter(candidate -> "F".equals(candidate.path("sourceLabel").asText()))
        .findFirst().orElseThrow();

    assertThat(vacation.path("markerCandidate").asBoolean()).isTrue();
    assertThat(vacation.path("semanticRole").asText()).isEqualTo("UNKNOWN");
    assertThat(free.path("markerCandidate").asBoolean()).isTrue();
  }

  @Test
  void asksAboutDifferentCodesInsideOneSemanticStatusColumn() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("March");
      sheet.createRow(0).createCell(10).setCellValue("Frei");
      var free = sheet.createRow(1);
      free.createCell(0).setCellValue(1);
      free.createCell(10).setCellValue("F");
      var unknown = sheet.createRow(2);
      unknown.createCell(0).setCellValue(2);
      unknown.createCell(10).setCellValue("U");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidates = analyzer.analyze(workbookBytes).analysis().path("workTypeCandidates");
    var markerLabels = java.util.stream.StreamSupport.stream(candidates.spliterator(), false)
        .filter(candidate -> candidate.path("markerCandidate").asBoolean())
        .map(candidate -> candidate.path("sourceLabel").asText())
        .collect(java.util.stream.Collectors.toSet());

    assertThat(markerLabels).containsExactlyInAnyOrder("F", "U");
  }

  @Test
  void infersHourlyUnitConversionFromWorkbookFormula() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Juli");
      sheet.createRow(0).createCell(1).setCellValue("Zimmer");
      sheet.createRow(1).createCell(1).setCellValue(12);
      sheet.createRow(33).createCell(1).setCellFormula("SUM(B2:B33)");
      sheet.createRow(34).createCell(1).setCellFormula("B34/2.4");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedCalculationType").asText()).isEqualTo("UNIT_BASED");
    assertThat(candidate.path("suggestedCompensationMethod").asText()).isEqualTo("HOURLY");
    assertThat(candidate.path("suggestedUnitsPerHour").asDouble()).isEqualTo(2.4);
    assertThat(candidate.path("confidence").asDouble()).isEqualTo(0.96);
  }

  @Test
  void infersDirectPerUnitPayAndRateFromWorkbookFormula() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Mai");
      sheet.createRow(0).createCell(2).setCellValue("Dampfsperre");
      sheet.createRow(4).createCell(2).setCellValue(1.5);
      sheet.createRow(5).createCell(2).setCellValue(100);
      sheet.getRow(5).createCell(15).setCellFormula("C6*(C5/P6)");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var candidate = analyzer.analyze(workbookBytes).analysis()
        .path("workTypeCandidates").get(0);

    assertThat(candidate.path("suggestedCalculationType").asText()).isEqualTo("UNIT_BASED");
    assertThat(candidate.path("suggestedCompensationMethod").asText()).isEqualTo("PER_UNIT");
    assertThat(candidate.path("suggestedRatePerUnit").asDouble()).isEqualTo(1.5);
    assertThat(candidate.path("confidence").asDouble()).isEqualTo(0.98);
  }

  @Test
  void usesFormulaStructureToSeparateRatesTeamSizeAndHourlyWork() throws Exception {
    byte[] workbookBytes;
    try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Month");
      sheet.createRow(2).createCell(14).setCellValue("Stunden");
      var headers = sheet.createRow(3);
      headers.createCell(2).setCellValue("Installation");
      headers.createCell(15).setCellValue("Team members");
      var rates = sheet.createRow(4);
      rates.createCell(2).setCellValue(1.5);
      rates.createCell(14).setCellValue(13);
      var work = sheet.createRow(5);
      work.createCell(2).setCellValue(100);
      work.createCell(14).setCellValue(7.5);
      work.createCell(15).setCellValue(4);
      work.createCell(17).setCellFormula("C6*(C5/P6)+O6*O5");
      workbook.write(output);
      workbookBytes = output.toByteArray();
    }

    var analysis = analyzer.analyze(workbookBytes).analysis();
    var candidates = analysis.path("workTypeCandidates");

    assertThat(candidates).hasSize(2);
    var installation = findCandidate(candidates, "Installation");
    assertThat(installation.path("occurrences").asInt()).isEqualTo(1);
    assertThat(installation.path("samples").get(0).asText()).contains("R6=");
    assertThat(installation.path("suggestedRatePerUnit").asDouble()).isEqualTo(1.5);

    var hours = findCandidate(candidates, "Stunden");
    assertThat(hours.path("occurrences").asInt()).isEqualTo(1);
    assertThat(hours.path("suggestedCalculationType").asText()).isEqualTo("TIME_BASED");
    assertThat(hours.path("suggestedCompensationMethod").asText()).isEqualTo("HOURLY");
    assertThat(hours.path("suggestedHourlyRate").asDouble()).isEqualTo(13);

    var metadata = analysis.path("metadataColumns");
    assertThat(metadata).hasSize(1);
    assertThat(metadata.get(0).path("sourceLabel").asText()).isEqualTo("Team members");
    assertThat(metadata.get(0).path("semanticRole").asText()).isEqualTo("TEAM_SIZE");
  }

  private JsonNode findCandidate(JsonNode candidates, String label) {
    for (JsonNode candidate : candidates) {
      if (label.equals(candidate.path("sourceLabel").asText())) return candidate;
    }
    throw new AssertionError("Missing candidate " + label);
  }
}
