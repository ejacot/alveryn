package com.alveryn.api.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.dataimport.service.TextWorkLogConverter;
import com.alveryn.api.dataimport.service.XlsxWorkbookAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class TextWorkLogConverterTest {
  @Test
  void convertsDatedIntervalsAndKeepsTheirOriginalText() throws Exception {
    String source = """
        01.05.26 ~ 09:45-17:15 FF
        =544,50€
        20.02.26 ~ 5:30-…
        """;
    var converter = new TextWorkLogConverter();
    var analyzer = new XlsxWorkbookAnalyzer(new ObjectMapper());

    var result = analyzer.analyze(converter.convert(source.getBytes()));

    assertThat(result.workbookData().path("sheets")).hasSize(1);
    var rows = result.workbookData().path("sheets").get(0).path("rows");
    assertThat(rows).hasSize(2);
    assertThat(rows.get(1).path("cells").get(0).path("display").asText())
        .isEqualTo("1.5.2026");
    assertThat(rows.get(1).path("cells").get(1).path("number").decimalValue())
        .isEqualByComparingTo("7.5");
    assertThat(rows.get(1).toString()).contains("01.05.26 ~ 09:45-17:15 FF");
  }
}
