package com.alveryn.api.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.dataimport.intelligence.ImportIntelligenceProperties;
import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

/** Opt-in live benchmark that sends synthetic documents only to the vision provider. */
class PayrollVisionFixtureBenchmarkTest {
  @Test
  void extractsOneCleanSyntheticPayslipPerSupportedBenchmarkCountry() throws Exception {
    String directory = System.getProperty("payrollVisionFixtureDir", "");
    String apiKey = System.getenv("GROQ_API_KEY");
    Assumptions.assumeFalse(directory.isBlank(),
        "Set -DpayrollVisionFixtureDir for the live vision benchmark");
    Assumptions.assumeTrue(apiKey != null && !apiKey.isBlank(),
        "Set GROQ_API_KEY for the live vision benchmark");

    Path fixtureDirectory = Path.of(directory);
    String requestedCountry = System.getProperty("payrollVisionCountry", "").toUpperCase();
    ObjectMapper mapper = new ObjectMapper();
    JsonNode fixtures = mapper.readTree(fixtureDirectory.resolve("manifest.json").toFile())
        .path("fixtures");
    Map<String, JsonNode> selected = new LinkedHashMap<>();
    fixtures.forEach(fixture -> {
      if ("clean".equals(variant(fixture.path("id").asText()))) {
        String country = fixture.path("country").asText();
        if (requestedCountry.isBlank() || requestedCountry.equals(country)) {
          selected.putIfAbsent(country, fixture);
        }
      }
    });
    if (requestedCountry.isBlank()) {
      assertThat(selected.keySet()).containsExactly("DE", "RO", "GB", "FR");
    } else {
      assertThat(selected).containsKey(requestedCountry);
    }

    var properties = new ImportIntelligenceProperties(
        true, apiKey,
        valueOrDefault("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        valueOrDefault("GROQ_MODEL", "openai/gpt-oss-20b"),
        valueOrDefault("GROQ_VISION_MODEL", "qwen/qwen3.6-27b"),
        Duration.ofSeconds(60));
    var service = new ImportIntelligenceService(properties, mapper);

    for (JsonNode expected : selected.values()) {
      Path image = fixtureDirectory.resolve(expected.path("file").asText());
      String dataUrl = "data:image/jpeg;base64," + Base64.getEncoder()
          .encodeToString(Files.readAllBytes(image));
      JsonNode actual = service.analyzeMonthlyPayrollImages(
          List.of(dataUrl), expected.path("year").asInt(), expected.path("month").asInt());

      assertThat(actual.path("status").asText())
          .as("provider status for %s", expected.path("id").asText())
          .isEqualTo("COMPLETED");
      assertDecimal(actual, expected, "normalHours");
      assertDecimal(actual, expected, "normalAmount");
      assertDecimal(actual, expected, "extraHours");
      assertDecimal(actual, expected, "extraAmount");
      assertDecimal(actual, expected, "grossAmount");
      assertThat(actual.path("currency").asText())
          .isEqualTo(expected.path("currency").asText());
    }
  }

  private static String variant(String id) {
    return id.substring(id.lastIndexOf('-') + 1);
  }

  private static String valueOrDefault(String name, String fallback) {
    String value = System.getenv(name);
    return value == null || value.isBlank() ? fallback : value;
  }

  private static void assertDecimal(JsonNode actual, JsonNode expected, String field) {
    assertThat(actual.path(field).decimalValue())
        .as("%s for %s", field, expected.path("id").asText())
        .isCloseTo(expected.path(field).decimalValue(),
            org.assertj.core.data.Offset.offset(new BigDecimal("0.02")));
  }
}
