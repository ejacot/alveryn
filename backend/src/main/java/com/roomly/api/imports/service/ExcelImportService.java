package com.roomly.api.imports.service;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.imports.dto.ExcelImportResponse;
import com.roomly.api.imports.entity.ExcelImportBatch;
import com.roomly.api.imports.repository.ExcelImportBatchRepository;
import com.roomly.api.salary.service.SalaryCalculationService;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ExcelImportService {
  private static final String IMPORTED_WORK_TYPE_NAME = "Imported Shift";
  private static final String IMPORTED_WORK_TYPE_NORMALIZED = "imported shift";
  private static final String IMPORTED_WORK_TYPE_COLOR = "#E5E7EB";
  private static final int FIRST_DATA_ROW_INDEX = 2;
  private static final int DAY_COLUMN_INDEX = 0;
  private static final int FIRST_WORK_COLUMN_INDEX = 1;
  private static final int LAST_WORK_COLUMN_INDEX = 9;
  private static final int ABSENCE_CODE_COLUMN_INDEX = 10;
  private static final int AUXILIARY_DAY_COLUMN_INDEX = 12;
  private static final int FIRST_NOTES_COLUMN_INDEX = 13;
  private static final Pattern YEAR_PATTERN = Pattern.compile("(19|20)\\d{2}");
  private static final Pattern TIME_PATTERN = Pattern.compile("(\\d{1,2}[:.]\\d{2})");
  private static final Pattern WORKSHEET_MONTH_SANITIZER = Pattern.compile("[^\\p{L}]");

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserAccountRepository users;
  private final WorkTypeRepository workTypes;
  private final WorkEntryRepository workEntries;
  private final TimeEntryDetailsRepository timeEntryDetails;
  private final AbsenceRepository absences;
  private final SalaryCalculationService salaryCalculationService;
  private final ExcelImportBatchRepository importBatches;

  @Transactional
  public ExcelImportResponse importSchedule(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ValidationException("An .xlsx file is required");
    }

    String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename().trim() : "schedule.xlsx";
    if (!fileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
      throw new ValidationException("Only .xlsx workbooks are supported");
    }

    byte[] fileBytes = readBytes(file);
    UUID userId = authenticatedUserAccessor.requireUserId();
    String fileSha256 = sha256(fileBytes);
    if (importBatches.existsByUserIdAndFileSha256(userId, fileSha256)) {
      throw new ConflictException("This Excel workbook was already imported");
    }

    int detectedYear = detectYear(fileName);
    UserAccount user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));

    ImportAccumulator accumulator = new ImportAccumulator(fileName, detectedYear);
    WorkType importedWorkType = ensureImportedWorkType(user, accumulator);

    try (InputStream inputStream = file.getInputStream(); Workbook workbook = new XSSFWorkbook(inputStream)) {
      DataFormatter formatter = new DataFormatter(Locale.ROOT);
      for (Sheet sheet : workbook) {
        Integer month = resolveMonth(sheet.getSheetName());
        if (month == null) {
          continue;
        }
        importMonthSheet(user, importedWorkType, detectedYear, month, sheet, formatter, accumulator);
      }
    } catch (IOException ex) {
      throw new ValidationException("The workbook could not be read");
    }

    importBatches.save(
        new ExcelImportBatch(
            user,
            fileName,
            fileSha256,
            detectedYear,
            accumulator.importedEntries,
            accumulator.importedAbsences));

    return new ExcelImportResponse(
        fileName,
        detectedYear,
        importedWorkType.getName(),
        accumulator.importedEntries,
        accumulator.importedAbsences,
        accumulator.createdWorkTypes,
        accumulator.skippedRows,
        List.copyOf(accumulator.warnings));
  }

  private void importMonthSheet(
      UserAccount user,
      WorkType importedWorkType,
      int year,
      int month,
      Sheet sheet,
      DataFormatter formatter,
      ImportAccumulator accumulator) {
    Map<Integer, String> workHeaders = resolveWorkHeaders(sheet, formatter);

    for (int rowIndex = FIRST_DATA_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }

      Integer day = resolveDay(row, formatter);
      if (day == null) {
        continue;
      }

      LocalDate workDate;
      try {
        workDate = LocalDate.of(year, month, day);
      } catch (RuntimeException ex) {
        accumulator.warn("Skipped %s %s: invalid day".formatted(sheet.getSheetName(), day));
        accumulator.skippedRows++;
        continue;
      }

      RowParsingResult parsed = parseRow(row, workHeaders, formatter);
      if (!parsed.hasWork() && parsed.absenceType() == null) {
        continue;
      }

      if (parsed.hasWork()) {
        if (absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            user.getId(), workDate, workDate)) {
          accumulator.warn("Skipped %s because an absence already exists on %s".formatted(sheet.getSheetName(), workDate));
          accumulator.skippedRows++;
          continue;
        }
        importWorkEntry(user.getId(), user, importedWorkType, workDate, parsed, accumulator);
        continue;
      }

      if (workEntries.existsByUserIdAndWorkDateBetween(user.getId(), workDate, workDate)) {
        accumulator.warn("Skipped absence on %s because work entries already exist".formatted(workDate));
        accumulator.skippedRows++;
        continue;
      }

      importAbsence(user, workDate, parsed, accumulator);
    }
  }

  private void importWorkEntry(
      UUID userId,
      UserAccount user,
      WorkType importedWorkType,
      LocalDate workDate,
      RowParsingResult parsed,
      ImportAccumulator accumulator) {
    BigDecimal calculatedMinutes = parsed.calculatedMinutes();
    if (calculatedMinutes == null || calculatedMinutes.signum() <= 0) {
      accumulator.warn("Skipped %s because no positive duration could be derived".formatted(workDate));
      accumulator.skippedRows++;
      return;
    }

    SalaryCalculationService.SalarySnapshot salary =
        salaryCalculationService.calculateForDate(userId, workDate, calculatedMinutes);
    WorkEntry entry =
        workEntries.save(
            new WorkEntry(
                user,
                importedWorkType,
                workDate,
                salary.hourlyRate(),
                salary.currency(),
                calculatedMinutes));
    entry.updateNotes(trimNotes(parsed.notes()));

    if (parsed.exactTimeRange() != null) {
      timeEntryDetails.save(
          new TimeEntryDetails(
              entry,
              parsed.exactTimeRange().start(),
              parsed.exactTimeRange().end(),
              parsed.exactTimeRange().breakMinutes()));
    }

    accumulator.importedEntries++;
  }

  private void importAbsence(
      UserAccount user,
      LocalDate workDate,
      RowParsingResult parsed,
      ImportAccumulator accumulator) {
    Absence absence = new Absence(user, parsed.absenceType(), workDate, workDate);
    absence.updateNotes(trimNotes(parsed.notes()));
    absences.save(absence);
    accumulator.importedAbsences++;
  }

  private WorkType ensureImportedWorkType(UserAccount user, ImportAccumulator accumulator) {
    return workTypes
        .findByUserIdAndNormalizedName(user.getId(), IMPORTED_WORK_TYPE_NORMALIZED)
        .orElseGet(
            () -> {
              WorkType workType = new WorkType(user, IMPORTED_WORK_TYPE_NAME, CalculationMethod.TIME_BASED);
              workType.changeColor(IMPORTED_WORK_TYPE_COLOR);
              workType.changeDisplayOrder(workTypes.findAllByUserIdOrderByDisplayOrderAscNameAsc(user.getId()).size());
              WorkType saved = workTypes.save(workType);
              accumulator.createdWorkTypes++;
              return saved;
            });
  }

  private Map<Integer, String> resolveWorkHeaders(Sheet sheet, DataFormatter formatter) {
    Row primaryRow = sheet.getRow(0);
    Row secondaryRow = sheet.getRow(1);
    Map<Integer, String> headers = new LinkedHashMap<>();

    for (int columnIndex = FIRST_WORK_COLUMN_INDEX; columnIndex <= LAST_WORK_COLUMN_INDEX; columnIndex++) {
      String primary = readCell(primaryRow, columnIndex, formatter);
      String secondary = readCell(secondaryRow, columnIndex, formatter);
      String combined = combineHeader(primary, secondary);
      if (!combined.isBlank()) {
        headers.put(columnIndex, combined);
      }
    }

    return headers;
  }

  private RowParsingResult parseRow(Row row, Map<Integer, String> workHeaders, DataFormatter formatter) {
    Map<String, String> breakdown = new LinkedHashMap<>();
    BigDecimal maxHours = BigDecimal.ZERO;

    for (Map.Entry<Integer, String> header : workHeaders.entrySet()) {
      String rawValue = readCell(row, header.getKey(), formatter);
      BigDecimal numericValue = parseDecimal(rawValue);
      if (numericValue == null || numericValue.signum() <= 0) {
        continue;
      }
      breakdown.put(header.getValue(), numericValue.stripTrailingZeros().toPlainString());
      if (numericValue.compareTo(maxHours) > 0) {
        maxHours = numericValue;
      }
    }

    String absenceCode = readCell(row, ABSENCE_CODE_COLUMN_INDEX, formatter);
    List<TimeRangeCandidate> timeRanges = collectTimeRanges(row, formatter);
    BigDecimal calculatedMinutes = calculateMinutes(timeRanges, maxHours);
    ExactTimeRange exactTimeRange =
        timeRanges.size() == 1 && calculatedMinutes != null
            ? buildExactRange(timeRanges.getFirst(), calculatedMinutes)
            : null;
    String notes = buildNotes(breakdown, absenceCode, row, formatter, timeRanges);

    return new RowParsingResult(
        calculatedMinutes,
        exactTimeRange,
        resolveAbsenceType(absenceCode, calculatedMinutes),
        notes,
        !breakdown.isEmpty() || !timeRanges.isEmpty());
  }

  private List<TimeRangeCandidate> collectTimeRanges(Row row, DataFormatter formatter) {
    List<TimeRangeCandidate> ranges = new ArrayList<>();
    short lastCellNum = row.getLastCellNum();
    for (int columnIndex = FIRST_NOTES_COLUMN_INDEX; columnIndex < lastCellNum; columnIndex++) {
      String value = readCell(row, columnIndex, formatter);
      if (value.isBlank()) {
        continue;
      }
      TimeRangeCandidate range = parseTimeRange(value, columnIndex);
      if (range != null) {
        ranges.add(range);
      }
    }
    return ranges;
  }

  private BigDecimal calculateMinutes(List<TimeRangeCandidate> timeRanges, BigDecimal maxHours) {
    if (!timeRanges.isEmpty()) {
      BigDecimal totalMinutes = BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE);
      for (TimeRangeCandidate range : timeRanges) {
        totalMinutes =
            totalMinutes
                .add(BigDecimal.valueOf(range.minutes()))
                .setScale(WorkEntry.TIME_SCALE, RoundingMode.UNNECESSARY);
      }
      return totalMinutes;
    }

    if (maxHours.signum() > 0) {
      return maxHours
          .multiply(BigDecimal.valueOf(60))
          .setScale(WorkEntry.TIME_SCALE, RoundingMode.HALF_UP);
    }

    return null;
  }

  private ExactTimeRange buildExactRange(TimeRangeCandidate candidate, BigDecimal calculatedMinutes) {
    BigDecimal interval = BigDecimal.valueOf(candidate.minutes()).setScale(WorkEntry.TIME_SCALE, RoundingMode.UNNECESSARY);
    if (interval.compareTo(calculatedMinutes) < 0) {
      return null;
    }

    BigDecimal breakMinutes = interval.subtract(calculatedMinutes);
    if (breakMinutes.remainder(BigDecimal.ONE).signum() != 0 || breakMinutes.compareTo(BigDecimal.valueOf(240)) > 0) {
      return null;
    }

    return new ExactTimeRange(candidate.start(), candidate.end(), breakMinutes.intValueExact());
  }

  private String buildNotes(
      Map<String, String> breakdown,
      String absenceCode,
      Row row,
      DataFormatter formatter,
      List<TimeRangeCandidate> timeRanges) {
    List<String> parts = new ArrayList<>();
    if (!breakdown.isEmpty()) {
      parts.add(
          "Breakdown: "
              + breakdown.entrySet().stream().map(entry -> entry.getKey() + "=" + entry.getValue()).reduce((left, right) -> left + "; " + right).orElse(""));
    }

    if (!absenceCode.isBlank()) {
      parts.add("Sheet code: " + absenceCode.trim());
    }

    if (!timeRanges.isEmpty()) {
      parts.add(
          "Shift ranges: "
              + timeRanges.stream().map(TimeRangeCandidate::rawValue).reduce((left, right) -> left + " | " + right).orElse(""));
    }

    short lastCellNum = row.getLastCellNum();
    for (int columnIndex = FIRST_NOTES_COLUMN_INDEX; columnIndex < lastCellNum; columnIndex++) {
      int currentColumn = columnIndex;
      String value = readCell(row, columnIndex, formatter);
      if (value.isBlank()) {
        continue;
      }
      boolean alreadyUsedAsTime = timeRanges.stream().anyMatch(range -> range.sourceColumn() == currentColumn);
      if (alreadyUsedAsTime) {
        String cleaned = stripTimeTokens(value);
        if (!cleaned.isBlank()) {
          parts.add(cleaned);
        }
        continue;
      }
      parts.add(value.trim());
    }

    return parts.stream().filter(part -> !part.isBlank()).reduce((left, right) -> left + "\n" + right).orElse(null);
  }

  private String stripTimeTokens(String value) {
    String stripped = TIME_PATTERN.matcher(value).replaceAll("");
    stripped = stripped.replace("-", " ").replace("|", " ").replace("  ", " ").trim();
    return stripped;
  }

  private AbsenceType resolveAbsenceType(String absenceCode, BigDecimal calculatedMinutes) {
    if (absenceCode == null || absenceCode.isBlank() || (calculatedMinutes != null && calculatedMinutes.signum() > 0)) {
      return null;
    }

    String normalized = absenceCode.trim().toUpperCase(Locale.ROOT);
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

  private Integer resolveDay(Row row, DataFormatter formatter) {
    String primary = readCell(row, DAY_COLUMN_INDEX, formatter);
    BigDecimal primaryDay = parseDecimal(primary);
    if (primaryDay != null) {
      return primaryDay.intValue();
    }
    String fallback = readCell(row, AUXILIARY_DAY_COLUMN_INDEX, formatter);
    BigDecimal fallbackDay = parseDecimal(fallback);
    return fallbackDay != null ? fallbackDay.intValue() : null;
  }

  private String combineHeader(String primary, String secondary) {
    String normalizedPrimary = primary != null ? primary.trim() : "";
    String normalizedSecondary = secondary != null ? secondary.trim() : "";

    if (normalizedPrimary.equalsIgnoreCase("Frei")) {
      return "";
    }
    if (normalizedPrimary.isBlank()) {
      return normalizedSecondary;
    }
    if (normalizedSecondary.isBlank()) {
      return normalizedPrimary;
    }
    return normalizedPrimary + " · " + normalizedSecondary;
  }

  private String readCell(Row row, int columnIndex, DataFormatter formatter) {
    if (row == null) {
      return "";
    }
    Cell cell = row.getCell(columnIndex);
    return cell == null ? "" : formatter.formatCellValue(cell).trim();
  }

  private BigDecimal parseDecimal(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String normalized = value.trim().replace(',', '.');
    if (!normalized.matches("-?\\d+(\\.\\d+)?")) {
      return null;
    }
    try {
      return new BigDecimal(normalized);
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private TimeRangeCandidate parseTimeRange(String value, int sourceColumn) {
    Matcher matcher = TIME_PATTERN.matcher(value);
    List<String> values = new ArrayList<>();
    while (matcher.find()) {
      values.add(matcher.group(1));
      if (values.size() == 2) {
        break;
      }
    }
    if (values.size() < 2) {
      return null;
    }

    LocalTime start = parseLocalTime(values.get(0));
    LocalTime end = parseLocalTime(values.get(1));
    if (start == null || end == null) {
      return null;
    }
    int minutes = TimeEntryDetails.intervalMinutes(start, end);
    return new TimeRangeCandidate(start, end, minutes, value.trim(), sourceColumn);
  }

  private LocalTime parseLocalTime(String value) {
    String normalized = value.replace('.', ':').trim();
    if (normalized.matches("\\d:\\d{2}")) {
      normalized = "0" + normalized;
    }
    try {
      return LocalTime.parse(normalized);
    } catch (RuntimeException ex) {
      return null;
    }
  }

  private int detectYear(String fileName) {
    Matcher matcher = YEAR_PATTERN.matcher(fileName);
    if (!matcher.find()) {
      throw new ValidationException("The workbook name must contain the target year");
    }
    return Integer.parseInt(matcher.group());
  }

  private Integer resolveMonth(String sheetName) {
    String normalized =
        WORKSHEET_MONTH_SANITIZER
            .matcher(sheetName.toLowerCase(Locale.ROOT))
            .replaceAll("");

    return switch (normalized) {
      case "januar" -> 1;
      case "februar" -> 2;
      case "märz", "marz" -> 3;
      case "april" -> 4;
      case "mai" -> 5;
      case "juni", "iuni" -> 6;
      case "juli", "iuli" -> 7;
      case "august" -> 8;
      case "september" -> 9;
      case "oktober", "october" -> 10;
      case "november" -> 11;
      case "dezember", "december" -> 12;
      default -> null;
    };
  }

  private byte[] readBytes(MultipartFile file) {
    try {
      return file.getBytes();
    } catch (IOException ex) {
      throw new ValidationException("The workbook could not be read");
    }
  }

  private String sha256(byte[] bytes) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(bytes);
      StringBuilder builder = new StringBuilder(hash.length * 2);
      for (byte value : hash) {
        builder.append(String.format("%02x", value));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }

  private String trimNotes(String notes) {
    if (notes == null || notes.isBlank()) {
      return null;
    }
    String trimmed = notes.trim();
    return trimmed.length() <= 500 ? trimmed : trimmed.substring(0, 500);
  }

  private static final class ImportAccumulator {
    private int importedEntries;
    private int importedAbsences;
    private int createdWorkTypes;
    private int skippedRows;
    private final List<String> warnings = new ArrayList<>();

    private ImportAccumulator(String fileName, int detectedYear) {}

    private void warn(String message) {
      if (warnings.size() < 50) {
        warnings.add(message);
        return;
      }
      if (warnings.size() == 50) {
        warnings.add("Additional warnings were omitted.");
      }
    }
  }

  private record RowParsingResult(
      BigDecimal calculatedMinutes,
      ExactTimeRange exactTimeRange,
      AbsenceType absenceType,
      String notes,
      boolean hasWork) {}

  private record TimeRangeCandidate(
      LocalTime start, LocalTime end, int minutes, String rawValue, int sourceColumn) {}

  private record ExactTimeRange(LocalTime start, LocalTime end, int breakMinutes) {}
}
