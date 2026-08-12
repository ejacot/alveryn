package com.alveryn.api.dataimport.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class PayrollSyntheticFixtureBenchmarkTest {
  @Test
  void deterministicOcrMatchesGeneratedGroundTruth() throws Exception {
    String directory = System.getProperty("payrollFixtureDir", "");
    Assumptions.assumeFalse(directory.isBlank(), "Set -DpayrollFixtureDir for the OCR benchmark");
    ObjectMapper mapper = new ObjectMapper();
    JsonNode fixtures = mapper.readTree(Path.of(directory, "manifest.json").toFile()).path("fixtures");
    PayrollOcrParser parser = new PayrollOcrParser(mapper);
    int evaluated = 0;
    for (JsonNode fixture : fixtures) {
      Path ocr = Path.of(directory, fixture.path("id").asText() + ".ocr.txt");
      if (!Files.exists(ocr)) continue;
      int expectedMonth = fixture.path("month").isNumber() ? fixture.path("month").asInt() : 1;
      JsonNode actual = parser.parse(Files.readString(ocr), 2026, expectedMonth);
      assertClose(fixture.path("normalHours"), actual.path("normalHours"), fixture.path("id").asText());
      assertClose(fixture.path("normalAmount"), actual.path("normalAmount"), fixture.path("id").asText());
      assertClose(fixture.path("grossAmount"), actual.path("grossAmount"), fixture.path("id").asText());
      evaluated++;
    }
    assertThat(evaluated).as("OCR fixtures evaluated").isGreaterThan(0);
  }

  private void assertClose(JsonNode expected, JsonNode actual, String id) {
    assertThat(actual.isNumber()).as("%s must have a numeric result", id).isTrue();
    BigDecimal delta = expected.decimalValue().subtract(actual.decimalValue()).abs();
    assertThat(delta).as("%s differs", id).isLessThanOrEqualTo(new BigDecimal("0.02"));
  }
}
