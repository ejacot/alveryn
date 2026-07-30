package com.alveryn.api.dataimport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import com.alveryn.api.worktype.entity.WorkType;

@Component
public class XlsxWorkbookAnalyzer {
  private static final int ANALYZER_VERSION = 8;
  private static final int MAX_SHEETS = 100;
  private static final int MAX_ROWS = 50_000;
  private static final int MAX_CELLS = 500_000;
  private static final Set<String> IGNORED_HEADERS = Set.of(
      "datum", "date", "tag", "day", "name", "total", "summe", "gesamt",
      "betrag", "lohn", "preis", "currency", "wahrung", "monat", "month",
      "ort", "location", "place", "beschreibung", "description", "notes",
      "kosten pro tag", "daily cost");

  private final ObjectMapper objectMapper;

  public XlsxWorkbookAnalyzer(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public Result analyze(byte[] bytes) {
    try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
      if (workbook.getNumberOfSheets() > MAX_SHEETS) {
        throw new IllegalArgumentException("Workbook contains too many sheets");
      }
      ObjectNode raw = objectMapper.createObjectNode();
      ArrayNode rawSheets = raw.putArray("sheets");
      ObjectNode analysis = objectMapper.createObjectNode();
      ArrayNode summaries = analysis.putArray("sheets");
      ArrayNode candidates = analysis.putArray("workTypeCandidates");
      ArrayNode questions = analysis.putArray("questions");
      Map<String, Candidate> candidateMap = new HashMap<>();
      Map<String, Map<String, Candidate>> semanticMarkerGroups = new HashMap<>();
      int totalRows = 0;
      int totalCells = 0;

      DataFormatter formatter = new DataFormatter(Locale.ROOT);
      for (Sheet sheet : workbook) {
        ObjectNode rawSheet = rawSheets.addObject();
        rawSheet.put("name", sheet.getSheetName());
        ArrayNode rows = rawSheet.putArray("rows");
        int sheetCells = 0;
        int formulaCount = 0;
        Map<Integer, Header> headers = findHeaders(sheet);
        Set<Integer> metadataColumns = new HashSet<>();
        collectFormulaEvidence(sheet, headers, candidateMap, metadataColumns);

        for (Row row : sheet) {
          if (++totalRows > MAX_ROWS) throw new IllegalArgumentException("Workbook contains too many rows");
          ArrayNode cells = rows.addObject().put("row", row.getRowNum() + 1).putArray("cells");
          for (Cell cell : row) {
            if (++totalCells > MAX_CELLS) throw new IllegalArgumentException("Workbook contains too many cells");
            if (cell.getCellType() == CellType.BLANK) continue;
            sheetCells++;
            ObjectNode value = cells.addObject();
            value.put("column", cell.getColumnIndex() + 1);
            value.put("display", formatter.formatCellValue(cell));
            value.put("type", cell.getCellType().name());
            if (cell.getCellType() == CellType.FORMULA) {
              formulaCount++;
              value.put("formula", cell.getCellFormula());
            } else if (cell.getCellType() == CellType.NUMERIC) {
              value.put("number", BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros());
              Header header = headers.get(cell.getColumnIndex());
              if (header != null
                  && !metadataColumns.contains(cell.getColumnIndex())
                  && cell.getNumericCellValue() != 0
                  && row.getRowNum() > header.row()) {
                Candidate candidate = candidateMap.computeIfAbsent(
                    key(header.label()), ignored -> new Candidate(header.label()));
                if (!candidate.acceptsRow(sheet.getSheetName(), row.getRowNum())) continue;
                candidate.observe(cell.getNumericCellValue(), sheet.getSheetName(), row.getRowNum() + 1);
              }
            } else if (cell.getCellType() == CellType.STRING) {
              Header header = headers.get(cell.getColumnIndex());
              String displayed = formatter.formatCellValue(cell).trim();
              if (header != null && row.getRowNum() > header.row()
                  && (isRestHeader(header.label()) || isAbsenceHeader(header.label()))
                  && !displayed.isBlank()) {
                candidateMap.computeIfAbsent(
                    key(header.label()), ignored -> new Candidate(header.label()))
                    .observeMarker(displayed, sheet.getSheetName(),
                        row.getRowNum() + 1);
                if (isShortMarker(displayed)) {
                  Candidate marker = semanticMarkerGroups
                      .computeIfAbsent(key(header.label()), ignored -> new HashMap<>())
                      .computeIfAbsent(key(displayed), ignored -> new Candidate(displayed));
                  marker.markerCandidate = true;
                  marker.observeMarker(displayed, sheet.getSheetName(), row.getRowNum() + 1);
                }
              } else if (header != null && rowHasDay(row) && isShortMarker(displayed)) {
                Candidate marker = candidateMap.computeIfAbsent(
                    key(displayed), ignored -> new Candidate(displayed));
                // A short note may repeat the name of a real numeric work column (for example
                // HSK or CH). Numeric evidence is authoritative; it must not be downgraded to
                // an absence/rest marker merely because the same code also appears in notes.
                if (marker.occurrences == 0) {
                  marker.markerCandidate = true;
                  marker.observeMarker(displayed, sheet.getSheetName(), row.getRowNum() + 1);
                }
              }
            }
          }
        }
        metadataColumns.stream().sorted().forEach(column -> {
          Header header = headers.get(column);
          if (header == null) return;
          ObjectNode role = analysis.withArray("metadataColumns").addObject();
          role.put("sheet", sheet.getSheetName());
          role.put("sourceLabel", header.label());
          role.put("column", column + 1);
          role.put("semanticRole", "TEAM_SIZE");
          role.put("reason", "This column is used as a divisor in payment formulas");
          role.put("confidence", 0.99);
        });
        summaries.addObject()
            .put("name", sheet.getSheetName())
            .put("rows", sheet.getPhysicalNumberOfRows())
            .put("nonEmptyCells", sheetCells)
            .put("formulas", formulaCount);
      }
      semanticMarkerGroups.values().stream()
          .filter(markers -> markers.size() > 1)
          .forEach(markers -> markers.forEach(candidateMap::putIfAbsent));

      candidateMap.values().stream()
          .sorted((a, b) -> a.label.compareToIgnoreCase(b.label))
          .forEach(candidate -> {
            ObjectNode node = candidates.addObject();
            node.put("sourceLabel", candidate.label);
            node.put("normalizedLabel", key(candidate.label));
            node.put("occurrences", candidate.occurrences);
            boolean surcharge = isSurchargeHeader(candidate.label);
            boolean restDay = isRestHeader(candidate.label);
            boolean absence = isAbsenceHeader(candidate.label);
            boolean marker = candidate.markerCandidate;
            boolean semanticHours = isTimeHeader(candidate.label);
            boolean looksLikeHours = semanticHours
                || candidate.formulaCalculationType == null
                    && candidate.maximum <= 24 && candidate.decimalValues > 0;
            boolean ambiguous = !semanticHours
                && candidate.formulaCalculationType == null
                && !looksLikeHours;
            node.put("suggestedAction", marker ? "REVIEW_PER_ENTRY" : surcharge ? "CONFIGURE_SURCHARGE"
                : restDay ? "MARK_REST_DAY" : absence ? "IMPORT_AS_ABSENCE" : "CREATE_NEW");
            if (marker) {
              node.put("semanticRole", "UNKNOWN");
              node.put("markerCandidate", true);
            }
            if (surcharge) node.put("semanticRole", "SURCHARGE");
            else if (restDay) node.put("semanticRole", "REST_DAY");
            else if (absence) node.put("semanticRole", "ABSENCE");
            node.put("suggestedCalculationType", semanticHours ? "TIME_BASED"
                : candidate.formulaCalculationType != null
                ? candidate.formulaCalculationType : looksLikeHours ? "TIME_BASED" : "UNKNOWN");
            node.put("suggestedCompensationMethod", semanticHours ? "HOURLY"
                : candidate.formulaCompensationMethod != null
                ? candidate.formulaCompensationMethod : "HOURLY");
            node.put("confidence", marker ? 0.0 : restDay || absence ? 0.96 : surcharge ? 0.82
                : semanticHours && candidate.ratePerUnit != null ? 0.99
                : candidate.formulaReason != null
                ? candidate.formulaConfidence : looksLikeHours ? 0.68 : 0.35);
            node.put("reason", marker
                ? "A short text code appears on dated rows; its meaning must be confirmed"
                : restDay
                ? "The label denotes a day without recorded work"
                : absence ? "The label denotes an absence rather than worked activity"
                : surcharge
                ? "The label indicates eligible hours for an extra-pay rule, not a separate activity"
                : semanticHours && candidate.ratePerUnit != null
                ? "The header denotes worked time and Excel multiplies it by an hourly rate"
                : candidate.formulaReason != null ? candidate.formulaReason : looksLikeHours
                ? "Values include fractions and stay within a normal working-day range"
                : ambiguous
                    ? "Whole numbers alone cannot safely distinguish hours from completed units"
                    : "The calculation method needs confirmation");
            if (candidate.unitsPerHour != null) node.put("suggestedUnitsPerHour", candidate.unitsPerHour);
            if (candidate.teamFormula) node.put("suggestedTeamworkEnabled", true);
            if (candidate.ratePerUnit != null) {
              node.put(semanticHours ? "suggestedHourlyRate" : "suggestedRatePerUnit",
                  candidate.ratePerUnit);
            }
            ArrayNode samples = node.putArray("samples");
            candidate.samples.forEach(samples::add);
            ObjectNode question = questions.addObject();
            question.put("code", "CONFIRM_WORK_TYPE");
            question.put("sourceLabel", candidate.label);
            question.put("prompt",
                "What does '" + candidate.label
                    + "' mean: an activity, extra pay, absence, or a column to ignore?");
            question.putArray("options").add("MATCH_EXISTING").add("TIME_BASED")
                .add("UNIT_BASED").add("FIXED_AMOUNT").add("CONFIGURE_SURCHARGE").add("IGNORE");
          });
      analysis.put("sheetCount", workbook.getNumberOfSheets());
      analysis.put("rowCount", totalRows);
      analysis.put("cellCount", totalCells);
      analysis.put("analyzerVersion", ANALYZER_VERSION);
      analysis.put("requiresReview", !questions.isEmpty());
      return new Result(raw, analysis, !questions.isEmpty());
    } catch (Exception exception) {
      throw new IllegalArgumentException("The file is not a valid readable .xlsx workbook", exception);
    }
  }

  private static final Pattern DIVISOR_CONVERSION =
      Pattern.compile("(?i)\\b([A-Z]{1,3})(\\d+)\\s*/\\s*([0-9]+(?:[.,][0-9]+)?)");
  private static final Pattern TEAM_UNIT_PAY =
      Pattern.compile(
          "(?i)\\b([A-Z]{1,3})(\\d+)\\s*\\*\\s*\\(\\s*\\1(\\d+)\\s*/\\s*([A-Z]{1,3})\\2\\s*\\)");
  private static final Pattern DIRECT_UNIT_PAY =
      Pattern.compile("(?i)\\b([A-Z]{1,3})(\\d+)\\s*\\*\\s*\\1(\\d+)\\b");

  private void collectFormulaEvidence(
      Sheet sheet, Map<Integer, Header> headers, Map<String, Candidate> candidates,
      Set<Integer> metadataColumns) {
    for (Row row : sheet) {
      for (Cell cell : row) {
        if (cell.getCellType() != CellType.FORMULA) continue;
        String formula = cell.getCellFormula();
        var conversion = DIVISOR_CONVERSION.matcher(formula);
        while (conversion.find()) {
          Candidate candidate = candidateForColumn(headers, candidates, conversion.group(1));
          if (candidate == null) continue;
          candidate.addFormulaRow(sheet.getSheetName(), Integer.parseInt(conversion.group(2)) - 1);
          double unitsPerHour = Double.parseDouble(conversion.group(3).replace(',', '.'));
          candidate.formulaCalculationType = "UNIT_BASED";
          candidate.formulaCompensationMethod = "HOURLY";
          candidate.unitsPerHour = unitsPerHour;
          candidate.formulaConfidence = 0.96;
          candidate.formulaReason =
              "Excel converts this quantity to hours by dividing it by " + unitsPerHour;
        }
        collectUnitPayEvidence(
            sheet, headers, candidates, metadataColumns, TEAM_UNIT_PAY.matcher(formula), true);
        collectUnitPayEvidence(
            sheet, headers, candidates, metadataColumns, DIRECT_UNIT_PAY.matcher(formula), false);
      }
    }
  }

  private void collectUnitPayEvidence(
      Sheet sheet, Map<Integer, Header> headers, Map<String, Candidate> candidates,
      Set<Integer> metadataColumns, java.util.regex.Matcher matcher, boolean teamFormula) {
    while (matcher.find()) {
      Candidate candidate = candidateForColumn(headers, candidates, matcher.group(1));
      if (candidate == null) continue;
      int column = CellReference.convertColStringToIndex(matcher.group(1));
      candidate.addFormulaRow(sheet.getSheetName(), Integer.parseInt(matcher.group(2)) - 1);
      int rateRow = Integer.parseInt(matcher.group(3)) - 1;
      if (teamFormula) {
        metadataColumns.add(CellReference.convertColStringToIndex(matcher.group(4)));
        candidate.teamFormula = true;
      }
      Cell rateCell = sheet.getRow(rateRow) == null ? null : sheet.getRow(rateRow).getCell(column);
      candidate.formulaCalculationType = "UNIT_BASED";
      candidate.formulaCompensationMethod = "PER_UNIT";
      candidate.formulaConfidence = teamFormula ? 0.98 : 0.97;
      candidate.formulaReason = teamFormula
          ? "Excel multiplies quantity by a per-unit rate and divides the result by team size"
          : "Excel multiplies quantity directly by a per-unit rate";
      if (rateCell != null && rateCell.getCellType() == CellType.NUMERIC) {
        candidate.ratePerUnit = rateCell.getNumericCellValue();
      }
    }
  }

  private Candidate candidateForColumn(
      Map<Integer, Header> headers, Map<String, Candidate> candidates, String columnLetters) {
    Header header = headers.get(CellReference.convertColStringToIndex(columnLetters));
    return header == null ? null
        : candidates.computeIfAbsent(key(header.label()), ignored -> new Candidate(header.label()));
  }

  public void matchExistingWorkTypes(JsonNode analysis, List<WorkType> workTypes) {
    if (!(analysis.path("workTypeCandidates") instanceof ArrayNode candidates)) return;
    for (JsonNode value : candidates) {
      ObjectNode candidate = (ObjectNode) value;
      String role = candidate.path("semanticRole").asText();
      if (candidate.path("markerCandidate").asBoolean()
          || "SURCHARGE".equals(role) || "REST_DAY".equals(role)
          || "ABSENCE".equals(role) || "IGNORE".equals(role)) continue;
      String source = key(candidate.path("sourceLabel").asText());
      WorkType best = null;
      double bestScore = 0;
      for (WorkType workType : workTypes) {
        if (!workType.isActive()) continue;
        double score = similarity(source, key(workType.getName()));
        if (score > bestScore) {
          best = workType;
          bestScore = score;
        }
      }
      if (best != null && bestScore >= 0.72) {
        candidate.put("suggestedAction", "MATCH_EXISTING");
        candidate.put("matchedWorkTypeId", best.getId().toString());
        candidate.put("matchedWorkTypeName", best.getName());
        candidate.put("suggestedCalculationType", best.getCalculationMethod().name());
        candidate.put("suggestedCompensationMethod", best.getCompensationMethod().name());
        candidate.put("confidence", bestScore);
        candidate.put("reason", bestScore == 1
            ? "The Excel label matches an existing work type"
            : "The Excel label appears to be an abbreviation or spelling variant");
      }
    }
  }

  private double similarity(String left, String right) {
    if (left.equals(right)) return 1;
    if (left.length() >= 2 && right.startsWith(left)) return 0.88;
    if (right.length() >= 2 && left.startsWith(right)) return 0.84;
    String acronym = java.util.Arrays.stream(right.split(" "))
        .filter(part -> !part.isBlank()).map(part -> part.substring(0, 1))
        .reduce("", String::concat);
    if (left.equals(acronym)) return 0.9;
    int distance = levenshtein(left, right);
    return 1.0 - ((double) distance / Math.max(left.length(), right.length()));
  }

  private int levenshtein(String left, String right) {
    int[] costs = new int[right.length() + 1];
    for (int j = 0; j <= right.length(); j++) costs[j] = j;
    for (int i = 1; i <= left.length(); i++) {
      int previous = costs[0];
      costs[0] = i;
      for (int j = 1; j <= right.length(); j++) {
        int old = costs[j];
        costs[j] = Math.min(Math.min(costs[j] + 1, costs[j - 1] + 1),
            previous + (left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1));
        previous = old;
      }
    }
    return costs[right.length()];
  }

  private Map<Integer, Header> findHeaders(Sheet sheet) {
    Map<Integer, Header> best = new HashMap<>();
    List<Map<Integer, Header>> rows = new ArrayList<>();
    int bestRow = 0;
    int last = Math.min(sheet.getLastRowNum(), 14);
    for (int rowIndex = 0; rowIndex <= last; rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) continue;
      Map<Integer, Header> current = new HashMap<>();
      for (Cell cell : row) {
        if (cell.getCellType() != CellType.STRING) continue;
        String label = cell.getStringCellValue().strip();
        if (label.length() >= 2 && label.length() <= 60) {
          current.put(cell.getColumnIndex(), new Header(label, rowIndex));
        }
      }
      rows.add(current);
      if (current.size() > best.size()) {
        best = new HashMap<>(current);
        bestRow = rowIndex;
      }
    }
    final int anchor = bestRow;
    Map<Integer, Header> selected = best;
    java.util.stream.IntStream.range(0, rows.size())
        .boxed()
        .sorted(java.util.Comparator
            .comparingInt((Integer index) -> Math.abs(index - anchor))
            .thenComparing(java.util.Comparator.reverseOrder()))
        .forEach(index -> rows.get(index).forEach(selected::putIfAbsent));
    var iterator = selected.entrySet().iterator();
    while (iterator.hasNext()) {
      if (IGNORED_HEADERS.contains(key(iterator.next().getValue().label()))) iterator.remove();
    }
    return selected;
  }

  private boolean isTimeHeader(String value) {
    return Set.of("hour", "hours", "worked hours", "time", "stunden", "stunde",
            "arbeitsstunden", "ore", "ora", "heures", "heure", "horas", "hora")
        .contains(key(value));
  }

  private boolean isSurchargeHeader(String value) {
    String normalized = key(value);
    return normalized.contains("zuschlag")
        || normalized.contains("surcharge")
        || normalized.contains("premium")
        || normalized.equals("spor")
        || normalized.contains("nachtstunde")
        || normalized.contains("night hour")
        || normalized.contains("ore de noapte")
        || normalized.contains("heures de nuit");
  }

  private boolean isRestHeader(String value) {
    String normalized = key(value);
    return Set.of("frei", "free", "rest", "rest day", "zi libera", "off").contains(normalized);
  }

  private boolean isAbsenceHeader(String value) {
    String normalized = key(value);
    return normalized.contains("krank") || normalized.contains("sick")
        || normalized.contains("vacation") || normalized.contains("urlaub")
        || normalized.contains("concediu") || normalized.contains("absence")
        || normalized.contains("absenta");
  }

  private boolean rowHasDay(Row row) {
    for (int index = 0; index < Math.min(3, row.getLastCellNum()); index++) {
      Cell cell = row.getCell(index);
      if (cell != null && cell.getCellType() == CellType.NUMERIC) {
        double value = cell.getNumericCellValue();
        if (value >= 1 && value <= 31 && value == Math.rint(value)) return true;
      }
    }
    return false;
  }

  private boolean isShortMarker(String value) {
    String normalized = key(value);
    return !normalized.isBlank() && normalized.length() <= 4
        && normalized.matches("[a-z]+");
  }

  private String key(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", " ")
        .strip();
  }

  public record Result(JsonNode workbookData, JsonNode analysis, boolean requiresReview) {}

  public int version() {
    return ANALYZER_VERSION;
  }

  private record Header(String label, int row) {}

  private static final class Candidate {
    private final String label;
    private int occurrences;
    private double maximum;
    private int decimalValues;
    private String formulaCalculationType;
    private String formulaCompensationMethod;
    private String formulaReason;
    private double formulaConfidence;
    private Double unitsPerHour;
    private Double ratePerUnit;
    private boolean teamFormula;
    private boolean markerCandidate;
    private final Map<String, Set<Integer>> formulaRowsBySheet = new HashMap<>();
    private final List<String> samples = new ArrayList<>();

    private Candidate(String label) {
      this.label = label;
    }

    private void observe(double value, String sheet, int row) {
      occurrences++;
      maximum = Math.max(maximum, Math.abs(value));
      if (value != Math.rint(value)) decimalValues++;
      if (samples.size() < 3) samples.add(sheet + "!R" + row + "=" + BigDecimal.valueOf(value).stripTrailingZeros());
    }

    private void observeMarker(String value, String sheet, int row) {
      occurrences++;
      if (samples.size() < 3) samples.add(sheet + "!R" + row + "=" + value);
    }

    private void addFormulaRow(String sheet, int zeroBasedRow) {
      formulaRowsBySheet.computeIfAbsent(sheet, ignored -> new HashSet<>()).add(zeroBasedRow);
    }

    private boolean acceptsRow(String sheet, int zeroBasedRow) {
      Set<Integer> rows = formulaRowsBySheet.get(sheet);
      return rows == null || rows.contains(zeroBasedRow);
    }
  }
}
