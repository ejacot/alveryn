package com.roomly.api.imports.parser;

import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.imports.model.ParsedWorkbook;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.stereotype.Component;

@Component
public class MarianaScheduleParser implements ExcelScheduleParser {
  private static final int FIRST_DATA_ROW_INDEX = 2;
  private static final int DAY_COLUMN_INDEX = 0;
  private static final int FIRST_WORK_COLUMN_INDEX = 1;
  private static final int LAST_WORK_COLUMN_INDEX = 9;
  private static final int ABSENCE_CODE_COLUMN_INDEX = 10;
  private static final int AUXILIARY_DAY_COLUMN_INDEX = 12;
  private static final int FIRST_NOTES_COLUMN_INDEX = 13;
  private static final Pattern TIME_PATTERN = Pattern.compile("(\\d{1,2}[:.]\\d{2})");

  private final MonthNameResolver monthNameResolver;
  private final CellValueReader cellValueReader;

  public MarianaScheduleParser(MonthNameResolver monthNameResolver, CellValueReader cellValueReader) {
    this.monthNameResolver = monthNameResolver;
    this.cellValueReader = cellValueReader;
  }

  @Override
  public boolean supports(Sheet sheet, FormulaEvaluator evaluator) {
    return monthNameResolver.resolve(sheet.getSheetName()) != null;
  }

  @Override
  public ParsedWorkbook parse(
      int detectedYear,
      Workbook workbook,
      FormulaEvaluator evaluator,
      int maxRowsPerSheet,
      int maxTotalRows) {
    List<ParsedWorkbook.ParsedMonth> months = new ArrayList<>();
    List<String> ignoredSheets = new ArrayList<>();
    List<ParsedWorkbook.ParsedWorkItem> workItems = new ArrayList<>();
    List<ParsedWorkbook.ParsedAbsenceItem> absenceItems = new ArrayList<>();
    List<String> warnings = new ArrayList<>();
    int skippedRows = 0;
    int processedRows = 0;

    for (Sheet sheet : workbook) {
      Integer month = monthNameResolver.resolve(sheet.getSheetName());
      if (month == null) {
        ignoredSheets.add(sheet.getSheetName());
        continue;
      }

      Map<Integer, String> workHeaders = resolveWorkHeaders(sheet, evaluator);
      int monthWorkEntries = 0;
      int monthAbsences = 0;
      int monthSkippedRows = 0;

      int lastRow = Math.min(sheet.getLastRowNum(), maxRowsPerSheet - 1);
      for (int rowIndex = FIRST_DATA_ROW_INDEX; rowIndex <= lastRow; rowIndex++) {
        if (++processedRows > maxTotalRows) {
          throw new IllegalArgumentException("Workbook exceeds the maximum supported row count");
        }
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
          continue;
        }
        Integer day = resolveDay(row, evaluator);
        if (day == null) {
          continue;
        }

        LocalDate workDate;
        try {
          workDate = LocalDate.of(detectedYear, month, day);
        } catch (RuntimeException ex) {
          warnings.add("Skipped " + sheet.getSheetName() + " " + day + ": invalid day");
          skippedRows++;
          monthSkippedRows++;
          continue;
        }

        RowParsingResult parsed = parseRow(row, workHeaders, evaluator);
        if (!parsed.hasWork() && parsed.absenceType() == null) {
          continue;
        }

        if (parsed.hasWork()) {
          if (parsed.calculatedMinutes() == null || parsed.calculatedMinutes().signum() <= 0) {
            warnings.add("Skipped " + workDate + ": no positive duration could be derived");
            skippedRows++;
            monthSkippedRows++;
            continue;
          }
          workItems.add(
              new ParsedWorkbook.ParsedWorkItem(
                  workDate,
                  sheet.getSheetName(),
                  "WORK|" + detectedYear + "|" + workDate + "|" + monthNameResolver.normalize(sheet.getSheetName()),
                  fingerprintForWork(workDate, parsed),
                  parsed.calculatedMinutes(),
                  parsed.exactTimeRange() != null ? parsed.exactTimeRange().start() : null,
                  parsed.exactTimeRange() != null ? parsed.exactTimeRange().end() : null,
                  parsed.exactTimeRange() != null ? parsed.exactTimeRange().breakMinutes() : null,
                  parsed.notes()));
          monthWorkEntries++;
          continue;
        }

        absenceItems.add(
            new ParsedWorkbook.ParsedAbsenceItem(
                workDate,
                sheet.getSheetName(),
                "ABSENCE|" + detectedYear + "|" + workDate + "|" + monthNameResolver.normalize(sheet.getSheetName()),
                fingerprintForAbsence(workDate, parsed),
                parsed.absenceType(),
                parsed.notes()));
        monthAbsences++;
      }

      months.add(new ParsedWorkbook.ParsedMonth(sheet.getSheetName(), month, monthWorkEntries, monthAbsences, monthSkippedRows));
    }

    return new ParsedWorkbook(detectedYear, months, ignoredSheets, workItems, absenceItems, warnings, skippedRows);
  }

  private Map<Integer, String> resolveWorkHeaders(Sheet sheet, FormulaEvaluator evaluator) {
    Map<Integer, String> headers = new LinkedHashMap<>();
    Row headerRow = sheet.getRow(0);
    if (headerRow == null) {
      return headers;
    }
    for (int cellIndex = FIRST_WORK_COLUMN_INDEX; cellIndex <= LAST_WORK_COLUMN_INDEX; cellIndex++) {
      String label = cellValueReader.readText(headerRow.getCell(cellIndex), evaluator);
      if (!label.isBlank()) {
        headers.put(cellIndex, label);
      }
    }
    return headers;
  }

  private Integer resolveDay(Row row, FormulaEvaluator evaluator) {
    BigDecimal primary = cellValueReader.readDecimal(row.getCell(DAY_COLUMN_INDEX), evaluator);
    if (primary != null) {
      return primary.intValue();
    }
    BigDecimal auxiliary = cellValueReader.readDecimal(row.getCell(AUXILIARY_DAY_COLUMN_INDEX), evaluator);
    return auxiliary != null ? auxiliary.intValue() : null;
  }

  private RowParsingResult parseRow(Row row, Map<Integer, String> workHeaders, FormulaEvaluator evaluator) {
    List<String> breakdown = new ArrayList<>();
    BigDecimal explicitTotalHours = null;

    for (int cellIndex = FIRST_WORK_COLUMN_INDEX; cellIndex <= LAST_WORK_COLUMN_INDEX; cellIndex++) {
      BigDecimal value = cellValueReader.readDecimal(row.getCell(cellIndex), evaluator);
      if (value == null || value.signum() <= 0) {
        continue;
      }
      String header = workHeaders.getOrDefault(cellIndex, "Column " + (cellIndex + 1));
      breakdown.add(header + "=" + value.stripTrailingZeros().toPlainString());
      if (explicitTotalHours == null || value.compareTo(explicitTotalHours) > 0) {
        explicitTotalHours = value;
      }
    }

    List<TimeRange> ranges = parseRanges(row, evaluator);
    BigDecimal minutes =
        !ranges.isEmpty()
            ? ranges.stream()
                .map(range -> BigDecimal.valueOf(range.totalWorkedMinutes()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(15, RoundingMode.HALF_UP)
            : explicitTotalHours != null
                ? explicitTotalHours.multiply(BigDecimal.valueOf(60)).setScale(15, RoundingMode.HALF_UP)
                : null;

    String absenceCode = cellValueReader.readText(row.getCell(ABSENCE_CODE_COLUMN_INDEX), evaluator);
    AbsenceType absenceType = minutes == null ? resolveAbsenceType(absenceCode) : null;

    List<String> notes = new ArrayList<>();
    if (!breakdown.isEmpty()) {
      notes.add("Breakdown: " + String.join("; ", breakdown));
    }
    if (!absenceCode.isBlank()) {
      notes.add("Sheet code: " + absenceCode.trim());
    }
    for (int cellIndex = FIRST_NOTES_COLUMN_INDEX; cellIndex < row.getLastCellNum(); cellIndex++) {
      String text = cellValueReader.readText(row.getCell(cellIndex), evaluator);
      if (!text.isBlank() && TIME_PATTERN.matcher(text).find()) {
        continue;
      }
      if (!text.isBlank()) {
        notes.add(text.trim());
      }
    }

    TimeRange exactRange = ranges.size() == 1 ? ranges.getFirst() : null;
    return new RowParsingResult(
        minutes,
        exactRange,
        absenceType,
        notes.isEmpty() ? null : String.join(" | ", notes));
  }

  private List<TimeRange> parseRanges(Row row, FormulaEvaluator evaluator) {
    List<TimeRange> ranges = new ArrayList<>();
    short lastCellNum = row.getLastCellNum();
    for (int cellIndex = FIRST_NOTES_COLUMN_INDEX; cellIndex < lastCellNum; cellIndex++) {
      String text = cellValueReader.readText(row.getCell(cellIndex), evaluator);
      if (text.isBlank()) {
        continue;
      }
      Matcher matcher = TIME_PATTERN.matcher(text);
      List<LocalTime> times = new ArrayList<>();
      while (matcher.find()) {
        LocalTime parsedTime = parseTime(matcher.group(1));
        if (parsedTime != null) {
          times.add(parsedTime);
        }
      }
      if (times.size() >= 2) {
        LocalTime start = times.get(0);
        LocalTime end = times.get(1);
        ranges.add(new TimeRange(start, end, 0));
      }
    }
    return ranges;
  }

  private LocalTime parseTime(String text) {
    String normalized = text.replace('.', ':');
    String[] parts = normalized.split(":");
    int hour = Integer.parseInt(parts[0]);
    int minute = Integer.parseInt(parts[1]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return LocalTime.of(hour, minute);
  }

  private AbsenceType resolveAbsenceType(String code) {
    String normalized = code == null ? "" : code.trim().toUpperCase();
    if (normalized.contains("FT")) {
      return AbsenceType.PUBLIC_HOLIDAY;
    }
    if (normalized.contains("U")) {
      return AbsenceType.VACATION;
    }
    if (normalized.contains("F")) {
      return AbsenceType.DAY_OFF;
    }
    return null;
  }

  private String fingerprintForWork(LocalDate date, RowParsingResult parsed) {
    return date
        + "|"
        + parsed.calculatedMinutes().stripTrailingZeros().toPlainString()
        + "|"
        + (parsed.notes() == null ? "" : parsed.notes().trim());
  }

  private String fingerprintForAbsence(LocalDate date, RowParsingResult parsed) {
    return date + "|" + parsed.absenceType() + "|" + (parsed.notes() == null ? "" : parsed.notes().trim());
  }

  private record RowParsingResult(
      BigDecimal calculatedMinutes, TimeRange exactTimeRange, AbsenceType absenceType, String notes) {
    boolean hasWork() {
      return calculatedMinutes != null && calculatedMinutes.signum() > 0;
    }
  }

  private record TimeRange(LocalTime start, LocalTime end, int breakMinutes) {
    int totalWorkedMinutes() {
      return com.roomly.api.workentry.entity.TimeEntryDetails.intervalMinutes(start, end) - breakMinutes;
    }
  }
}
