package com.alveryn.api.dataimport.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class PayrollOcrParserTest {
  private final PayrollOcrParser parser = new PayrollOcrParser(new ObjectMapper());

  @Test
  void extractsGermanPayrollWithoutAiAndKeepsSplitSurchargeHoursOnce() {
    String ocr = """
        Abrechnung der Brutto-Netto-Bezüge Januar 2026
        Lohnart Bezeichnung bezahlte Menge Faktor %-Zuschlag Betrag
        1 Lohn 219,60 15,5000 3.403,80 EUR
        38 Nachtzuschlag 30% 3,00 4,6500 30,00 13,95 EUR
        959 Sonntagszuschlag 50% steuerfrei 38,00 7,7500 294,50 EUR
        969 Sonntagszuschlag 50% pflichtig 38,00 4,6500 176,70 EUR
        Gesamtbrutto 3.888,95 EUR
        """;

    var result = parser.parse(ocr, 2026, 1);

    assertThat(result.path("status").asText()).isEqualTo("COMPLETED");
    assertThat(result.path("countryCode").asText()).isEqualTo("DE");
    assertThat(result.path("currency").asText()).isEqualTo("EUR");
    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("219.6");
    assertThat(result.path("normalAmount").decimalValue()).isEqualByComparingTo("3403.8");
    assertThat(result.path("extraHours").decimalValue()).isEqualByComparingTo("41");
    assertThat(result.path("extraAmount").decimalValue()).isEqualByComparingTo("485.15");
    assertThat(result.path("grossAmount").decimalValue()).isEqualByComparingTo("3888.95");
  }

  @Test
  void extractsRomanianFragmentAndInfersOnlyTheMissingPeriod() {
    String ocr = """
        Cod Denumire Ore Tarif Valoare
        100 Salariu de bază — ore lucrate 168,00 30,00 5.040,00 RON
        310 Spor de noapte 25% 24,00 7,50 180,00 RON
        Total brut 5.220,00 RON
        """;

    var result = parser.parse(ocr, 2026, 8);

    assertThat(result.path("countryCode").asText()).isEqualTo("RO");
    assertThat(result.path("documentCompleteness").asText()).isEqualTo("FRAGMENT");
    assertThat(result.path("periodInferredFromCalendar").asBoolean()).isTrue();
    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("168");
    assertThat(result.path("extraHours").decimalValue()).isEqualByComparingTo("24");
    assertThat(result.path("grossAmount").decimalValue()).isEqualByComparingTo("5220");
  }

  @Test
  void ignoresTaxInsuranceAndNetRows() {
    String ocr = """
        Employee payslip Pay period 08/2026 GBP
        100 Regular pay 160.00 20.00 3200.00 GBP
        Income tax 500.00 GBP
        National Insurance 220.00 GBP
        Net pay 2480.00 GBP
        Gross pay 3200.00 GBP
        """;

    var result = parser.parse(ocr, 2026, 8);

    assertThat(result.path("payrollLines")).hasSize(1);
    assertThat(result.path("normalAmount").decimalValue()).isEqualByComparingTo("3200");
    assertThat(result.path("grossAmount").decimalValue()).isEqualByComparingTo("3200");
  }

  @Test
  void preservesVisibleHoursFromAPartialFaintTableRow() {
    String ocr = """
        Abrechnung der Brutto-Netto-Bezüge
        1 Lohn 219,60
        38 Nachtzuschlag 30% 3,00 4,6500
        """;

    var result = parser.parse(ocr, 2026, 1);

    assertThat(result.path("normalHours").decimalValue()).isEqualByComparingTo("219.6");
    assertThat(result.path("normalAmount").isNull()).isTrue();
    assertThat(result.path("requiresReview").asBoolean()).isTrue();
  }
}
