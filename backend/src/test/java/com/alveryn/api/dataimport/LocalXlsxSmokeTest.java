package com.alveryn.api.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.dataimport.service.XlsxWorkbookAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

class LocalXlsxSmokeTest {
  @Test
  @EnabledIfEnvironmentVariable(named = "ALVERYN_XLSX_SMOKE_FILE", matches = ".+")
  void analyzesARealLocalWorkbook() throws Exception {
    var result = new XlsxWorkbookAnalyzer(new ObjectMapper())
        .analyze(Files.readAllBytes(Path.of(System.getenv("ALVERYN_XLSX_SMOKE_FILE"))));

    assertThat(result.analysis().path("sheetCount").asInt()).isPositive();
  }
}
