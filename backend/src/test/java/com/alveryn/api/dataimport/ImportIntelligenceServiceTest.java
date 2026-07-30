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
}
