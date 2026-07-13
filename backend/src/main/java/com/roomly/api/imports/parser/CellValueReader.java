package com.roomly.api.imports.parser;

import java.math.BigDecimal;
import java.util.Locale;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.springframework.stereotype.Component;

@Component
public class CellValueReader {
  private static final DataFormatter FORMATTER = new DataFormatter(Locale.ROOT);

  public String readText(Cell cell, FormulaEvaluator evaluator) {
    if (cell == null) {
      return "";
    }
    return FORMATTER.formatCellValue(cell, evaluator).trim();
  }

  public BigDecimal readDecimal(Cell cell, FormulaEvaluator evaluator) {
    String text = readText(cell, evaluator).replace(',', '.').trim();
    if (text.isEmpty()) {
      return null;
    }
    try {
      return new BigDecimal(text);
    } catch (NumberFormatException ignored) {
      if (cell.getCellType() == CellType.NUMERIC) {
        return BigDecimal.valueOf(cell.getNumericCellValue());
      }
      return null;
    }
  }
}
