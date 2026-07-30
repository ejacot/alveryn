package com.alveryn.api.dataimport.service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

/**
 * Converts simple work notes to the same tabular representation used by the Excel importer.
 * The original line is always retained in Notes, so parsing never destroys source evidence.
 */
@Component
public class TextWorkLogConverter {
  private static final Pattern DATED_LINE = Pattern.compile(
      "^\\s*(\\d{1,2}[.]\\d{1,2}[.]\\d{2,4})\\s*(?:~|[-–—])?\\s*"
          + "(\\d{1,2}:\\d{2})\\s*[-–—]\\s*(\\d{1,2}:\\d{2})(.*)$");
  private static final DateTimeFormatter SHORT_DATE =
      DateTimeFormatter.ofPattern("d.M.yy", Locale.ROOT);
  private static final DateTimeFormatter LONG_DATE =
      DateTimeFormatter.ofPattern("d.M.uuuu", Locale.ROOT);
  private static final DateTimeFormatter TIME =
      DateTimeFormatter.ofPattern("H:mm", Locale.ROOT);

  public byte[] convert(byte[] source) {
    String text = new String(source, StandardCharsets.UTF_8)
        .replace("\uFEFF", "");
    List<ParsedRow> rows = new ArrayList<>();
    int recognized = 0;

    for (String original : text.split("\\R", -1)) {
      Matcher matcher = DATED_LINE.matcher(original);
      if (!matcher.matches()) continue;
      LocalDate date = parseDate(matcher.group(1));
      if (date == null) continue;

      ParsedInterval interval = parseInterval(matcher.group(2), matcher.group(3));
      rows.add(new ParsedRow(date, interval, original.trim()));
      recognized++;
    }

    if (recognized == 0) {
      throw new IllegalArgumentException(
          "No dated work intervals were found. Expected lines such as 01.05.26 ~ 05:30-13:00");
    }

    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      writeSheet(workbook.createSheet("Work notes"), rows);
      workbook.write(output);
      return output.toByteArray();
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not prepare the text file for analysis", exception);
    }
  }

  private void writeSheet(Sheet sheet, List<ParsedRow> parsedRows) {
    Row header = sheet.createRow(0);
    header.createCell(0).setCellValue("Date");
    header.createCell(1).setCellValue("Hours");
    header.createCell(2).setCellValue("Notes");

    int rowNumber = 1;
    for (ParsedRow parsed : parsedRows) {
      Row row = sheet.createRow(rowNumber++);
      row.createCell(0).setCellValue(parsed.date.format(LONG_DATE));
      if (parsed.interval != null) {
        row.createCell(1).setCellValue(parsed.interval.hours.doubleValue());
      }
      row.createCell(2).setCellValue(parsed.original);
    }
  }

  private LocalDate parseDate(String value) {
    try {
      return LocalDate.parse(value, value.substring(value.lastIndexOf('.') + 1).length() == 2
          ? SHORT_DATE : LONG_DATE);
    } catch (DateTimeParseException ignored) {
      return null;
    }
  }

  private ParsedInterval parseInterval(String startValue, String endValue) {
    try {
      LocalTime start = LocalTime.parse(startValue, TIME);
      LocalTime end = LocalTime.parse(endValue, TIME);
      long minutes = Duration.between(start, end).toMinutes();
      if (minutes <= 0) minutes += 24 * 60;
      // Longer values are usually typing errors, not overnight shifts.
      if (minutes <= 0 || minutes > 16 * 60) return null;
      return new ParsedInterval(BigDecimal.valueOf(minutes)
          .divide(BigDecimal.valueOf(60), 4, java.math.RoundingMode.HALF_UP));
    } catch (DateTimeParseException ignored) {
      return null;
    }
  }

  private record ParsedInterval(BigDecimal hours) {}
  private record ParsedRow(LocalDate date, ParsedInterval interval, String original) {}
}
