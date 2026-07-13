package com.roomly.api.imports.parser;

import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.imports.model.ExcelImportErrorCode;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.stereotype.Component;

@Component
public class YearResolver {
  private static final Pattern YEAR_PATTERN = Pattern.compile("(19|20)\\d{2}");

  private final CellValueReader cellValueReader;

  public YearResolver(CellValueReader cellValueReader) {
    this.cellValueReader = cellValueReader;
  }

  public int resolveYear(String fileName, Workbook workbook, FormulaEvaluator evaluator, Integer fallbackYear) {
    Integer fileNameYear = extractYear(fileName);
    Set<Integer> workbookYears = extractWorkbookYears(workbook, evaluator);

    if (fileNameYear != null && !workbookYears.isEmpty() && !workbookYears.contains(fileNameYear)) {
      throw new ValidationException(
          "The workbook contains a year that conflicts with the filename",
          ExcelImportErrorCode.EXCEL_YEAR_CONFLICT.name());
    }

    if (fileNameYear != null) {
      return fileNameYear;
    }

    if (workbookYears.size() == 1) {
      return workbookYears.iterator().next();
    }

    if (workbookYears.size() > 1) {
      throw new ValidationException(
          "Multiple conflicting years were detected in the workbook",
          ExcelImportErrorCode.EXCEL_YEAR_CONFLICT.name());
    }

    if (fallbackYear != null) {
      return fallbackYear;
    }

    throw new ValidationException(
        "The workbook year could not be detected",
        ExcelImportErrorCode.EXCEL_YEAR_MISSING.name());
  }

  private Integer extractYear(String fileName) {
    Matcher matcher = YEAR_PATTERN.matcher(fileName == null ? "" : fileName);
    return matcher.find() ? Integer.parseInt(matcher.group()) : null;
  }

  private Set<Integer> extractWorkbookYears(Workbook workbook, FormulaEvaluator evaluator) {
    Set<Integer> years = new LinkedHashSet<>();
    for (Sheet sheet : workbook) {
      for (int rowIndex = 0; rowIndex <= Math.min(sheet.getLastRowNum(), 4); rowIndex++) {
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
          continue;
        }
        short maxCell = (short) Math.min(row.getLastCellNum(), 8);
        for (int cellIndex = 0; cellIndex < maxCell; cellIndex++) {
          String text = cellValueReader.readText(row.getCell(cellIndex), evaluator);
          Matcher matcher = YEAR_PATTERN.matcher(text);
          if (matcher.find()) {
            years.add(Integer.parseInt(matcher.group()));
          }
        }
      }
    }
    return years;
  }
}
