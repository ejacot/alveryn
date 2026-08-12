package com.alveryn.api.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.dataimport.intelligence.ImportIntelligenceProperties;
import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

class ImportIntelligenceServiceTest {
  @Test
  void fallsBackWithoutSendingAnythingWhenFreeProviderIsDisabled() {
    var mapper = new ObjectMapper();
    var properties = new ImportIntelligenceProperties(
        false, "", "https://api.groq.com/openai/v1", "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b", Duration.ofSeconds(30));
    var analysis = mapper.createObjectNode();
    analysis.putArray("workTypeCandidates").addObject()
        .put("sourceLabel", "CH")
        .put("confidence", 0.68);

    var outcome = new ImportIntelligenceService(properties, mapper).enrich(analysis);

    assertThat(outcome.used()).isFalse();
    assertThat(outcome.status()).isEqualTo("DISABLED");
    assertThat(analysis.path("ai").path("status").asText()).isEqualTo("DISABLED");
  }

  @Test
  void countsTaxableAndTaxFreeSurchargeHoursOnceButKeepsBothAmounts() throws Exception {
    var mapper = new ObjectMapper();
    var properties = new ImportIntelligenceProperties(
        false, "", "https://api.groq.com/openai/v1", "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b", Duration.ofSeconds(30));
    var service = new ImportIntelligenceService(properties, mapper);
    var result = mapper.createObjectNode();
    var lines = result.putArray("payrollLines");
    lines.addObject().put("code", "959")
        .put("label", "Sonntagszuschlag (50%) st.frei")
        .put("quantity", 28.5).put("percentage", 50).put("amount", 249.38);
    lines.addObject().put("code", "969")
        .put("label", "Sonntagszuschlag (50%) pfl.")
        .put("quantity", 28.5).put("percentage", 50).put("amount", 149.62);

    Method aggregate = ImportIntelligenceService.class
        .getDeclaredMethod("aggregatePayrollLines", com.fasterxml.jackson.databind.node.ObjectNode.class);
    aggregate.setAccessible(true);
    aggregate.invoke(service, result);

    assertThat(result.path("extraHours").decimalValue()).isEqualByComparingTo("28.5");
    assertThat(result.path("extraAmount").decimalValue()).isEqualByComparingTo("399.00");
  }

  @Test
  void repairsVisionHoursFromPrintedFactorAndAmount() throws Exception {
    var mapper = new ObjectMapper();
    var properties = new ImportIntelligenceProperties(
        false, "", "https://api.groq.com/openai/v1", "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b", Duration.ofSeconds(30));
    var service = new ImportIntelligenceService(properties, mapper);
    var result = mapper.createObjectNode().put("normalHours", 165);
    var lines = result.putArray("payrollLines");
    lines.addObject().put("code", "1").put("label", "Lohn")
        .put("quantity", 165).put("factor", 15.50).put("amount", 3403.80);
    lines.addObject().put("code", "959").put("label", "Sonntagszuschlag (50%) steuerfrei")
        .put("quantity", 38).put("factor", 7.75).put("percentage", 50).put("amount", 294.50);

    Method aggregate = ImportIntelligenceService.class
        .getDeclaredMethod("aggregatePayrollLines", com.fasterxml.jackson.databind.node.ObjectNode.class);
    aggregate.setAccessible(true);
    aggregate.invoke(service, result);

    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("219.6");
    assertThat(result.path("normalRate").decimalValue()).isEqualByComparingTo("15.5");
    assertThat(result.path("normalAmount").decimalValue()).isEqualByComparingTo("3403.8");
    assertThat(result.path("payrollLines").path(0).path("quantity").decimalValue())
        .isEqualByComparingTo("219.6");
  }

  @Test
  void classifiesRomanianRegularPayAndSurchargesWithoutGermanLabels() throws Exception {
    var mapper = new ObjectMapper();
    var properties = new ImportIntelligenceProperties(
        false, "", "https://api.groq.com/openai/v1", "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b", Duration.ofSeconds(30));
    var service = new ImportIntelligenceService(properties, mapper);
    var result = mapper.createObjectNode();
    var lines = result.putArray("payrollLines");
    lines.addObject().put("code", "100").put("label", "Salariu de bază — ore lucrate")
        .put("category", "REGULAR_PAY").put("unit", "ore")
        .put("quantity", 168).put("factor", 30).put("amount", 5040);
    lines.addObject().put("code", "310").put("label", "Spor de noapte 25%")
        .put("category", "SURCHARGE").put("unit", "ore")
        .put("quantity", 24).put("factor", 7.5).put("percentage", 25).put("amount", 180);

    Method aggregate = ImportIntelligenceService.class
        .getDeclaredMethod("aggregatePayrollLines", com.fasterxml.jackson.databind.node.ObjectNode.class);
    aggregate.setAccessible(true);
    aggregate.invoke(service, result);

    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("168");
    assertThat(result.path("normalAmount").decimalValue()).isEqualByComparingTo("5040");
    assertThat(result.path("extraHours").decimalValue()).isEqualByComparingTo("24");
    assertThat(result.path("extraAmount").decimalValue()).isEqualByComparingTo("180");
  }

  @Test
  void rejectsHallucinatedTaxTableRowsAndRebuildsGrossFromEarnings() throws Exception {
    var mapper = new ObjectMapper();
    var properties = new ImportIntelligenceProperties(
        false, "", "https://api.groq.com/openai/v1", "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b", Duration.ofSeconds(30));
    var service = new ImportIntelligenceService(properties, mapper);
    var result = mapper.createObjectNode().put("grossAmount", 10_043_468.51);
    var lines = result.putArray("payrollLines");
    lines.addObject().put("code", "1").put("label", "Lohn").put("unit", "h")
        .put("quantity", 219.6).put("factor", 15.5).put("amount", 3403.8);
    lines.addObject().put("code", "38").put("label", "Nachtzuschlag 30%")
        .put("quantity", 3).put("factor", 4.65).put("percentage", 30).put("amount", 13.95);
    lines.addObject().put("code", "959").put("label", "Sonntagszuschlag (50%) steuerfrei")
        .put("quantity", 38).put("factor", 7.75).put("percentage", 50).put("amount", 294.5);
    lines.addObject().put("code", "969").put("label", "Sonntagszuschlag (50%) pflichtig")
        .put("quantity", 38).put("factor", 4.65).put("percentage", 50).put("amount", 176.7);
    lines.addObject().put("label", "3.580,50 EUR 434,25 EUR 0,00 EUR")
        .put("quantity", 0.1213).put("factor", 3580.5).put("amount", 434.25);
    lines.addObject().put("label", "Lohn+Gehalt Beraterversion premium 26.01")
        .put("quantity", 224.612).put("factor", 9.02).put("amount", 2026);
    lines.addObject().put("label", "[ent_os1ozot8 [aus")
        .put("category", "REGULAR_PAY")
        .put("quantity", 1).put("factor", 1).put("amount", 1);
    lines.addObject().put("label", "____[awiwante nen Personangruppe")
        .put("category", "REGULAR_PAY")
        .put("quantity", 45.5479).put("factor", 14.6).put("amount", 665);

    Method sanitize = ImportIntelligenceService.class
        .getDeclaredMethod("sanitizePayrollLines", com.fasterxml.jackson.databind.node.ObjectNode.class);
    sanitize.setAccessible(true);
    sanitize.invoke(service, result);
    Method aggregate = ImportIntelligenceService.class
        .getDeclaredMethod("aggregatePayrollLines", com.fasterxml.jackson.databind.node.ObjectNode.class);
    aggregate.setAccessible(true);
    aggregate.invoke(service, result);

    assertThat(result.path("payrollLines")).hasSize(4);
    assertThat(result.path("grossAmount").decimalValue()).isEqualByComparingTo("3888.95");
    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("219.6");
    assertThat(result.path("extraHours").decimalValue()).isEqualByComparingTo("41");
    assertThat(result.path("extraAmount").decimalValue()).isEqualByComparingTo("485.15");
  }
}
