package com.alveryn.api.imports.parser;

import com.alveryn.api.imports.model.ParsedWorkbook;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Sheet;

public interface ExcelScheduleParser {
  boolean supports(Sheet sheet, FormulaEvaluator evaluator);

  ParsedWorkbook parse(
      int detectedYear,
      org.apache.poi.ss.usermodel.Workbook workbook,
      FormulaEvaluator evaluator,
      int maxRowsPerSheet,
      int maxTotalRows);
}
