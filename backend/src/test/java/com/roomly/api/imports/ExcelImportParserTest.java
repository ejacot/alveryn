package com.roomly.api.imports;

import static org.assertj.core.api.Assertions.assertThat;

import com.roomly.api.imports.parser.CellValueReader;
import com.roomly.api.imports.parser.MarianaScheduleParser;
import com.roomly.api.imports.parser.MonthNameResolver;
import java.math.BigDecimal;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class ExcelImportParserTest {

  @Test
  void monthResolverRecognizesEncodedSheetNames() {
    MonthNameResolver resolver = new MonthNameResolver();

    assertThat(resolver.resolve("März_x0009__x0009_")).isEqualTo(3);
  }

  @Test
  void parserIgnoresInvalidTimeLikeTokensInsteadOfFailing() throws Exception {
    MonthNameResolver monthNameResolver = new MonthNameResolver();
    MarianaScheduleParser parser =
        new MarianaScheduleParser(monthNameResolver, new CellValueReader());

    try (XSSFWorkbook workbook = new XSSFWorkbook()) {
      var sheet = workbook.createSheet("März_x0009__x0009_");
      var headerRow = sheet.createRow(0);
      headerRow.createCell(1).setCellValue("Total");

      var row = sheet.createRow(2);
      row.createCell(0).setCellValue(1);
      row.createCell(1).setCellValue(8);
      row.createCell(13).setCellValue("29.09");

      FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
      var parsed = parser.parse(2025, workbook, evaluator, 1000, 12000);

      assertThat(parsed.recognizedSheets()).hasSize(1);
      assertThat(parsed.ignoredSheets()).isEmpty();
      assertThat(parsed.workItems()).hasSize(1);
      assertThat(parsed.workItems().getFirst().calculatedMinutes())
          .isEqualByComparingTo(BigDecimal.valueOf(480).setScale(15));
      assertThat(parsed.absenceItems()).isEmpty();
      assertThat(parsed.warnings()).isEmpty();
    }
  }
}
