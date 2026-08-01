package com.alveryn.api.dataimport.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.dataimport.dto.DataImportExecuteRequest;
import com.alveryn.api.dataimport.dto.DataImportExecuteResponse;
import com.alveryn.api.dataimport.dto.DataImportPreviewResponse;
import com.alveryn.api.dataimport.dto.DataImportChatRequest;
import com.alveryn.api.dataimport.dto.DataImportChatResponse;
import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.alveryn.api.dataimport.entity.DataImportBatch;
import com.alveryn.api.dataimport.entity.DataImportStatus;
import com.alveryn.api.dataimport.entity.DataImportWorkTypeMapping;
import com.alveryn.api.dataimport.repository.DataImportBatchRepository;
import com.alveryn.api.dataimport.repository.DataImportWorkTypeMappingRepository;
import com.alveryn.api.workrecord.dto.WorkRecordLineRequest;
import com.alveryn.api.workrecord.dto.WorkRecordRequest;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.workrecord.service.WorkRecordService;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.restday.service.EmploymentRestDayService;
import com.alveryn.api.restday.dto.RestDayRequest;
import com.alveryn.api.restday.repository.EmploymentRestDayRepository;
import com.alveryn.api.absence.service.AbsenceService;
import com.alveryn.api.absence.dto.AbsenceRequest;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DataImportEntryService {
  private static final Pattern YEAR = Pattern.compile("\\b(20\\d{2})\\b");
  private static final Pattern INTERVAL =
      Pattern.compile("(?i)\\b([01]?\\d|2[0-3]):[0-5]\\d\\s*[-–]\\s*([01]?\\d|2[0-3]):[0-5]\\d\\b");
  private static final Set<String> MONTH_1 = Set.of("january", "januar", "ianuarie", "jan");
  private static final Set<String> MONTH_2 = Set.of("february", "februar", "februarie", "feb");
  private static final Set<String> MONTH_3 = Set.of("march", "marz", "märz", "martie", "mar");
  private static final Set<String> MONTH_4 = Set.of("april", "aprilie", "apr");
  private static final Set<String> MONTH_5 = Set.of("may", "mai");
  private static final Set<String> MONTH_6 = Set.of("june", "juni", "iunie", "iun");
  private static final Set<String> MONTH_7 = Set.of("july", "juli", "iulie", "iul");
  private static final Set<String> MONTH_8 = Set.of("august");
  private static final Set<String> MONTH_9 = Set.of("september", "septembrie", "sep");
  private static final Set<String> MONTH_10 = Set.of("october", "oktober", "octombrie", "oct");
  private static final Set<String> MONTH_11 = Set.of("november", "noiembrie", "nov");
  private static final Set<String> MONTH_12 = Set.of("december", "dezember", "decembrie", "dec");

  private final AuthenticatedUserAccessor userAccessor;
  private final DataImportBatchRepository batches;
  private final DataImportWorkTypeMappingRepository mappings;
  private final WorkRecordRepository records;
  private final WorkRecordService workRecordService;
  private final WorkTypeRepository workTypes;
  private final ImportIntelligenceService intelligence;
  private final EmploymentRestDayService restDayService;
  private final EmploymentRestDayRepository restDays;
  private final AbsenceService absenceService;
  private final AbsenceRepository absences;

  @Transactional(readOnly = true)
  public DataImportPreviewResponse preview(UUID batchId) {
    UUID userId = userAccessor.requireUserId();
    DataImportBatch batch = requireReadyBatch(batchId, userId);
    return buildPreview(batch, userId);
  }

  @Transactional(readOnly = true)
  public DataImportChatResponse chat(UUID batchId, DataImportChatRequest request) {
    UUID userId = userAccessor.requireUserId();
    DataImportBatch batch = requireReadyBatch(batchId, userId);
    DataImportPreviewResponse.Entry entry = buildPreview(batch, userId).entries().stream()
        .filter(candidate -> candidate.questions().stream()
            .anyMatch(question -> question.id().equals(request.questionId())))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Import question was not found"));
    DataImportPreviewResponse.Question question = entry.questions().stream()
        .filter(candidate -> candidate.id().equals(request.questionId()))
        .findFirst().orElseThrow();
    var interpreted = intelligence.interpretImportQuestion(
        question.type(), question.sourceLabel(), question.value(), entry.date().toString(),
        request.messages().stream()
            .map(message -> new ImportIntelligenceService.ChatLine(
                message.role().name(), message.content().trim()))
            .toList(),
        entry.lines().stream()
            .map(line -> new ImportIntelligenceService.WorkLine(
                line.workTypeId(), line.workTypeName(), line.calculationMethod(), line.value()))
            .toList());
    DataImportChatResponse.Proposal proposal = validateProposal(question, entry, interpreted);
    String status = proposal == null ? interpreted.status() : "PROPOSAL";
    if ("PROPOSAL".equals(interpreted.status()) && proposal == null) {
      status = "NEEDS_CLARIFICATION";
    }
    return new DataImportChatResponse(status, interpreted.message(), proposal);
  }

  private DataImportChatResponse.Proposal validateProposal(
      DataImportPreviewResponse.Question question,
      DataImportPreviewResponse.Entry entry,
      ImportIntelligenceService.ChatInterpretation interpreted) {
    if (!"PROPOSAL".equals(interpreted.status()) || interpreted.action() == null) return null;
    DataImportExecuteRequest.Action action;
    try {
      action = DataImportExecuteRequest.Action.valueOf(interpreted.action());
    } catch (IllegalArgumentException exception) {
      return null;
    }
    var resolution = new DataImportExecuteRequest.Resolution(
        action, interpreted.percentage(), interpreted.targetWorkTypeId(),
        interpreted.eligibleHours(), null);
    if (!validResolution(question, resolution)) return null;
    if (action == DataImportExecuteRequest.Action.ENTER_PERCENTAGE) {
      var target = entry.lines().stream()
          .filter(line -> line.workTypeId().equals(interpreted.targetWorkTypeId()))
          .filter(line -> "TIME_BASED".equals(line.calculationMethod()))
          .findFirst().orElse(null);
      if (target == null || interpreted.eligibleHours().compareTo(target.value()) > 0) return null;
    }
    return new DataImportChatResponse.Proposal(
        action, interpreted.percentage(), interpreted.targetWorkTypeId(),
        interpreted.eligibleHours(), interpreted.confirmation());
  }

  @Transactional
  public DataImportExecuteResponse execute(UUID batchId, DataImportExecuteRequest request) {
    UUID userId = userAccessor.requireUserId();
    DataImportBatch batch = requireReadyBatch(batchId, userId);
    Map<String, DataImportPreviewResponse.Entry> preview = buildPreview(batch, userId).entries()
        .stream().collect(java.util.stream.Collectors.toMap(
            DataImportPreviewResponse.Entry::id, entry -> entry));
    Set<String> requested = new HashSet<>(request.entryIds());
    if (requested.size() != request.entryIds().size()) {
      throw new IllegalArgumentException("Every selected import entry must be unique");
    }
    int importedRecords = 0;
    int importedLines = 0;
    List<String> skipped = new ArrayList<>();
    for (String id : requested) {
      var entry = preview.get(id);
      if (entry == null || "DUPLICATE".equals(entry.status())) {
        skipped.add(id);
        continue;
      }
      var entryOverride = request.entryOverrides() == null
          ? null : request.entryOverrides().get(id);
      if (entryOverride != null) {
        if (entryOverride.lineValues() != null
            && entryOverride.lineValues().size() != entry.lines().size()) {
          throw new IllegalArgumentException("Every edited activity must retain its work type");
        }
        var editedLines = new ArrayList<DataImportPreviewResponse.Line>();
        for (int index = 0; index < entry.lines().size(); index++) {
          var line = entry.lines().get(index);
          BigDecimal value = entryOverride.lineValues() == null
              ? line.value() : entryOverride.lineValues().get(index);
          Integer minutes = "TIME_BASED".equals(line.calculationMethod())
              ? value.multiply(BigDecimal.valueOf(60)).setScale(0,
                  java.math.RoundingMode.HALF_UP).intValueExact()
              : line.durationMinutes();
          editedLines.add(new DataImportPreviewResponse.Line(
              line.workTypeId(), line.workTypeName(), line.calculationMethod(), value, minutes));
        }
        entry = new DataImportPreviewResponse.Entry(
            entry.id(), entry.date(), entry.status(), entry.classification(),
            entry.absenceType(), entry.absencePaid(), entry.absencePaidMinutesPerDay(),
            entry.teamSize(), entry.sheet(), entry.sourceRow(), entryOverride.notes(),
            editedLines, entry.questions());
      }
      if ("REST_DAY".equals(entry.classification())) {
        restDayService.mark(
            batch.getEmployment().getId(), entry.date(), new RestDayRequest(entry.notes()));
        importedRecords++;
        continue;
      }
      if ("ABSENCE".equals(entry.classification())) {
        absenceService.createImported(new AbsenceRequest(
                batch.getEmployment().getId(), null,
                AbsenceType.valueOf(entry.absenceType()), entry.date(), entry.date(), entry.notes()),
            Boolean.TRUE.equals(entry.absencePaid()),
            entry.absencePaidMinutesPerDay() == null ? 0 : entry.absencePaidMinutesPerDay());
        importedRecords++;
        continue;
      }
      if (entry.lines().isEmpty()) {
        skipped.add(id);
        continue;
      }
      Map<String, DataImportExecuteRequest.Resolution> resolutions =
          request.resolutions() == null ? Map.of() : request.resolutions();
      if (entry.questions().stream().anyMatch(question ->
          !validResolution(question, resolutions.get(question.id())))) {
        skipped.add(id);
        continue;
      }
      Map<UUID, SurchargeApplication> surcharges = new HashMap<>();
      entry.questions().stream()
          .filter(question -> "SURCHARGE".equals(question.type()))
          .map(question -> resolutions.get(question.id()))
          .filter(java.util.Objects::nonNull)
          .filter(resolution -> resolution.action()
              == DataImportExecuteRequest.Action.ENTER_PERCENTAGE)
          .forEach(resolution -> {
            if (resolution.allocations() != null && !resolution.allocations().isEmpty()) {
              resolution.allocations().forEach(allocation -> surcharges.merge(
                  allocation.workTypeId(),
                  new SurchargeApplication(resolution.percentage(), allocation.eligibleHours()),
                  DataImportEntryService::higherPercentage));
            } else if (resolution.targetWorkTypeId() != null && resolution.eligibleHours() != null) {
              surcharges.merge(resolution.targetWorkTypeId(),
                  new SurchargeApplication(resolution.percentage(), resolution.eligibleHours()),
                  DataImportEntryService::higherPercentage);
            }
          });
      surcharges.keySet().forEach(workTypeId -> workTypes.findByIdAndUserId(
          workTypeId, userId).ifPresent(type -> type.changeExtraPayEnabled(true)));
      String resolvedNotes = entry.questions().stream()
          .filter(question -> {
            var resolution = resolutions.get(question.id());
            return resolution != null && resolution.action()
                == DataImportExecuteRequest.Action.ADD_AS_NOTE;
          })
          .map(DataImportPreviewResponse.Question::value)
          .collect(java.util.stream.Collectors.joining("\n"));
      String notes = java.util.stream.Stream.of(entry.notes(), resolvedNotes)
          .filter(java.util.Objects::nonNull)
          .filter(value -> !value.isBlank())
          .collect(java.util.stream.Collectors.joining("\n"));
      String interval = entry.questions().stream()
          .filter(question -> {
            var resolution = resolutions.get(question.id());
            return resolution != null && resolution.action()
                == DataImportExecuteRequest.Action.USE_AS_INTERVAL;
          })
          .map(DataImportPreviewResponse.Question::value)
          .findFirst().orElse(null);
      LocalDate importDate = entry.date();
      List<WorkRecordLineRequest> lines = entry.lines().stream()
          .flatMap(line -> toRequests(importDate, line, surcharges.get(line.workTypeId()), interval).stream())
          .toList();
      workRecordService.create(new WorkRecordRequest(
          entry.date(), null, null, entry.teamSize(), notes.isBlank() ? null : notes, lines));
      importedRecords++;
      importedLines += lines.size();
    }
    if (importedRecords > 0 && skipped.isEmpty()
        && buildPreview(batch, userId).readyCount() == 0) {
      batch.markImported();
    }
    return new DataImportExecuteResponse(
        batch.getId(), importedRecords, importedLines, skipped);
  }

  private boolean validResolution(
      DataImportPreviewResponse.Question question,
      DataImportExecuteRequest.Resolution resolution) {
    if (resolution == null) return false;
    if ("SURCHARGE".equals(question.type())) {
      return resolution.action() == DataImportExecuteRequest.Action.IGNORE
          || resolution.action() == DataImportExecuteRequest.Action.USE_EMPLOYMENT_RULE
          || resolution.action() == DataImportExecuteRequest.Action.ENTER_PERCENTAGE
              && resolution.percentage() != null
              && (resolution.allocations() != null && !resolution.allocations().isEmpty()
                  || resolution.targetWorkTypeId() != null && resolution.eligibleHours() != null);
    }
    return resolution.action() == DataImportExecuteRequest.Action.IGNORE
        || resolution.action() == DataImportExecuteRequest.Action.ADD_AS_NOTE
        || resolution.action() == DataImportExecuteRequest.Action.USE_AS_INTERVAL
            && INTERVAL.matcher(question.value()).find();
  }

  private List<WorkRecordLineRequest> toRequests(
      LocalDate entryDate,
      DataImportPreviewResponse.Line line,
      SurchargeApplication surcharge,
      String interval) {
    boolean time = "TIME_BASED".equals(line.calculationMethod());
    LocalTime start = null;
    LocalTime end = null;
    if (time && interval != null) {
      var matcher = INTERVAL.matcher(interval);
      if (matcher.find()) {
        start = LocalTime.parse(normalizeTime(matcher.group(1)));
        end = LocalTime.parse(normalizeTime(matcher.group(2)));
      }
    }
    if (!time || surcharge == null) {
      return List.of(lineRequest(line, start, end,
          time && start == null ? line.durationMinutes() : null, BigDecimal.ZERO));
    }
    int eligibleMinutes = surcharge.eligibleHours()
        .multiply(BigDecimal.valueOf(60)).intValueExact();
    if (eligibleMinutes > line.durationMinutes()) {
      throw new IllegalArgumentException(
          "Extra-pay eligible hours cannot exceed the base activity hours on "
              + entryDate + " for " + line.workTypeName() + " (eligible: "
              + surcharge.eligibleHours() + " h, base: "
              + BigDecimal.valueOf(line.durationMinutes()).divide(BigDecimal.valueOf(60))
              + " h)");
    }
    if (eligibleMinutes == line.durationMinutes()) {
      return List.of(lineRequest(line, start, end,
          start == null ? eligibleMinutes : null, surcharge.percentage()));
    }
    return List.of(
        lineRequest(line, null, null,
            line.durationMinutes() - eligibleMinutes, BigDecimal.ZERO),
        lineRequest(line, null, null,
            eligibleMinutes, surcharge.percentage()));
  }

  private static SurchargeApplication higherPercentage(
      SurchargeApplication left, SurchargeApplication right) {
    return left.percentage().compareTo(right.percentage()) >= 0 ? left : right;
  }

  private record SurchargeApplication(BigDecimal percentage, BigDecimal eligibleHours) {}

  private WorkRecordLineRequest lineRequest(
      DataImportPreviewResponse.Line line,
      LocalTime start,
      LocalTime end,
      Integer durationMinutes,
      BigDecimal extraPercentage) {
    boolean time = "TIME_BASED".equals(line.calculationMethod());
    return new WorkRecordLineRequest(
        line.workTypeId(), time ? null : line.value(),
        null, null, start, end, durationMinutes,
        0, extraPercentage, null);
  }

  private String normalizeTime(String value) {
    return value.length() == 4 ? "0" + value : value;
  }

  private DataImportPreviewResponse buildPreview(DataImportBatch batch, UUID userId) {
    List<DataImportPreviewResponse.Entry> entries = new ArrayList<>();
    for (JsonNode sheet : batch.getWorkbookData().path("sheets")) {
      Map<Integer, String> sheetHeaders = headerColumns(sheet);
      Set<Integer> tableColumns = sheetHeaders.keySet();
      Map<Integer, DataImportWorkTypeMapping> columns = activityColumns(batch, sheet);
      Map<Integer, String> surchargeColumns = semanticColumns(batch, sheet, "SURCHARGE");
      Set<Integer> teamSizeColumns = metadataColumns(batch, sheet, "TEAM_SIZE");
      Map<Integer, String> restColumns = decisionColumns(batch, sheet, "MARK_REST_DAY");
      Map<Integer, String> absenceColumns = decisionColumns(batch, sheet, "IMPORT_AS_ABSENCE");
      Set<String> restMarkers = decisionMarkers(batch, "MARK_REST_DAY").keySet();
      Map<String, String> absenceMarkers = decisionMarkers(batch, "IMPORT_AS_ABSENCE");
      Map<String, AbsenceImportRule> absenceRules = absenceRules(batch);
      boolean explicitDates = batch.getAnalysis().path("datesAreExplicit").asBoolean(false);
      JsonNode sheetPeriod = findSheetPeriod(batch, sheet.path("name").asText());
      int year = sheetPeriod.path("year").asInt(
          batch.getAnalysis().path("periodContext").path("year").asInt(0));
      if (year == 0 && !explicitDates) year = inferYear(batch.getSourceFilename());
      int month = sheetPeriod.path("month").asInt(
          batch.getAnalysis().path("periodContext").path("month").asInt(0));
      if (month == 0) {
        month = inferMonth(sheet.path("name").asText());
      }
      if (month == 0) {
        month = inferMonth(batch.getSourceFilename());
      }
      if (month == 0 && !explicitDates) {
        throw new IllegalArgumentException(
            "Could not determine the month from the filename or sheet name");
      }
      for (JsonNode row : sheet.path("rows")) {
        LocalDate date = explicitDate(row);
        if (date == null) {
          Integer day = day(row);
          if (day == null) continue;
          try {
            date = LocalDate.of(year, month, day);
          } catch (Exception ignored) {
            continue;
          }
        }
        List<DataImportPreviewResponse.Line> lines = new ArrayList<>();
        List<DataImportPreviewResponse.Question> questions = new ArrayList<>();
        List<String> freeText = new ArrayList<>();
        boolean restMarker = false;
        String absenceType = null;
        Boolean absencePaid = null;
        Integer absencePaidMinutesPerDay = null;
        Integer teamSize = null;
        for (JsonNode cell : row.path("cells")) {
          int column = cell.path("column").asInt();
          String displayedValue = cell.path("display").asText().trim();
          if (teamSizeColumns.contains(column) && cell.path("number").isNumber()) {
            BigDecimal value = cell.path("number").decimalValue();
            if (value.signum() > 0) teamSize = value.intValue();
            continue;
          }
          if ("STRING".equals(cell.path("type").asText())
              && tableColumns.contains(column)) {
            String marker = DataImportWorkTypeMapping.normalize(displayedValue);
            if (absenceMarkers.containsKey(marker)) {
              AbsenceImportRule rule = absenceRules.get(marker);
              absenceType = rule == null ? absenceMarkers.get(marker) : rule.type();
              absencePaid = rule == null ? false : rule.paid();
              absencePaidMinutesPerDay = rule == null ? 0 : rule.paidMinutesPerDay();
              continue;
            }
            if (restMarkers.contains(marker)) {
              restMarker = true;
              continue;
            }
          }
          boolean present = !cell.path("display").asText().trim().isBlank()
              && (!cell.path("number").isNumber()
                  || cell.path("number").decimalValue().signum() != 0);
          if (present && restColumns.containsKey(column)) restMarker = true;
          if (present && absenceColumns.containsKey(column)) {
            absenceType = absenceColumns.get(column);
            AbsenceImportRule rule = absenceRules.get(DataImportWorkTypeMapping.normalize(
                sheetHeaders.getOrDefault(column, "")));
            if (rule != null) {
              absencePaid = rule.paid();
              absencePaidMinutesPerDay = rule.paidMinutesPerDay();
            }
          }
          var mapping = columns.get(column);
          if (mapping != null && cell.path("number").isNumber()
              && cell.path("number").decimalValue().signum() > 0) {
            var workType = mapping.getWorkType();
            BigDecimal value = cell.path("number").decimalValue();
            Integer minutes = workType.getCalculationMethod() == CalculationMethod.TIME_BASED
                ? value.multiply(BigDecimal.valueOf(60))
                    .setScale(0, java.math.RoundingMode.HALF_UP).intValueExact()
                : null;
            lines.add(new DataImportPreviewResponse.Line(
                workType.getId(), workType.getName(),
                workType.getCalculationMethod().name(), value, minutes));
          } else if (surchargeColumns.containsKey(column)
              && cell.path("number").isNumber()
              && cell.path("number").decimalValue().signum() > 0) {
            String label = surchargeColumns.get(column);
            String questionId = entryId(sheet, row) + ":surcharge:" + column;
            questions.add(new DataImportPreviewResponse.Question(
                questionId, "SURCHARGE", label, cell.path("display").asText(),
                "On " + date + ", Alveryn found base work and "
                    + cell.path("display").asText() + " hours in '" + label
                    + "'. Choose the base activity that receives the extra percentage.",
                List.of("ENTER_PERCENTAGE", "USE_EMPLOYMENT_RULE", "IGNORE")));
          } else if ("STRING".equals(cell.path("type").asText())) {
            String text = cell.path("display").asText().trim();
            if (!text.isBlank() && !isHeader(text, sheet)
                && !restColumns.containsKey(column)
                && !absenceColumns.containsKey(column)) freeText.add(text);
          }
        }
        String importedNotes = freeText.stream().distinct()
            .collect(java.util.stream.Collectors.joining("\n"));
        if (!lines.isEmpty() && (restMarker || absenceType != null)) {
          String marker = absenceType != null ? "Absence: " + absenceType : "Rest day";
          questions.add(new DataImportPreviewResponse.Question(
              entryId(sheet, row) + ":classification-conflict",
              "NOTE", null, marker,
              "On " + date + ", Alveryn found both worked activity and a non-work marker. "
                  + "The calculated work remains authoritative. Keep the marker as a note?",
              List.of("ADD_AS_NOTE", "IGNORE")));
        }
        String classification = !lines.isEmpty() ? "WORK"
            : absenceType != null ? "ABSENCE" : restMarker ? "REST_DAY" : "WORK";
        if (lines.isEmpty() && questions.isEmpty()
            && !"REST_DAY".equals(classification) && !"ABSENCE".equals(classification)) continue;
        boolean duplicate = "REST_DAY".equals(classification)
            ? restDays.findByEmploymentIdAndDate(batch.getEmployment().getId(), date).isPresent()
            : "ABSENCE".equals(classification)
                ? absences.existsByUserIdAndEmploymentIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                    userId, batch.getEmployment().getId(), date, date)
                : records.existsByUserIdAndEmploymentIdAndWorkDateBetween(
                    userId, batch.getEmployment().getId(), date, date);
        String status = duplicate ? "DUPLICATE"
            : questions.isEmpty()
                && (!lines.isEmpty() || !"WORK".equals(classification))
                    ? "READY" : "NEEDS_INPUT";
        entries.add(new DataImportPreviewResponse.Entry(
            entryId(sheet, row), date, status, classification, absenceType,
            absencePaid, absencePaidMinutesPerDay, teamSize,
            sheet.path("name").asText(),
            row.path("row").asInt(), importedNotes.isBlank() ? null : importedNotes,
            lines, questions));
      }
    }
    int ready = (int) entries.stream().filter(e -> "READY".equals(e.status())).count();
    int questions = (int) entries.stream().filter(e -> "NEEDS_INPUT".equals(e.status())).count();
    int duplicates = (int) entries.stream().filter(e -> "DUPLICATE".equals(e.status())).count();
    return new DataImportPreviewResponse(batch.getId(), ready, questions, duplicates, entries);
  }

  private JsonNode findSheetPeriod(DataImportBatch batch, String sheetName) {
    for (JsonNode period : batch.getAnalysis().path("sheetPeriodContexts")) {
      if (sheetName.equals(period.path("sheet").asText())) return period;
    }
    return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
  }

  private Map<Integer, DataImportWorkTypeMapping> activityColumns(
      DataImportBatch batch, JsonNode sheet) {
    Map<String, DataImportWorkTypeMapping> byLabel = new HashMap<>();
    mappings.findAllByUserIdAndEmploymentId(
        batch.getUser().getId(), batch.getEmployment().getId()).stream()
        .filter(mapping -> mapping.getSemanticRole()
            == DataImportWorkTypeMapping.SemanticRole.ACTIVITY)
        .forEach(mapping -> byLabel.put(mapping.getNormalizedSourceLabel(), mapping));
    Map<Integer, DataImportWorkTypeMapping> result = new LinkedHashMap<>();
    headerColumns(sheet).forEach((column, label) -> {
      var mapping = byLabel.get(DataImportWorkTypeMapping.normalize(label));
      if (mapping != null) result.put(column, mapping);
    });
    return result;
  }

  private Map<Integer, String> semanticColumns(
      DataImportBatch batch, JsonNode sheet, String role) {
    Map<String, String> labels = new HashMap<>();
    batch.getAnalysis().path("workTypeCandidates").forEach(candidate -> {
      if (role.equals(candidate.path("semanticRole").asText())) {
        labels.put(DataImportWorkTypeMapping.normalize(
            candidate.path("sourceLabel").asText()), candidate.path("sourceLabel").asText());
      }
    });
    Map<Integer, String> result = new HashMap<>();
    headerColumns(sheet).forEach((column, label) -> {
      String match = labels.get(DataImportWorkTypeMapping.normalize(label));
      if (match != null) result.put(column, match);
    });
    return result;
  }

  private Set<Integer> metadataColumns(
      DataImportBatch batch, JsonNode sheet, String role) {
    Set<Integer> columns = new HashSet<>();
    String sheetName = sheet.path("name").asText();
    for (JsonNode value : batch.getAnalysis().path("metadataColumns")) {
      if (sheetName.equals(value.path("sheet").asText())
          && role.equals(value.path("semanticRole").asText())) {
        columns.add(value.path("column").asInt());
      }
    }
    return columns;
  }

  private Map<Integer, String> decisionColumns(
      DataImportBatch batch, JsonNode sheet, String action) {
    Map<String, String> labels = new HashMap<>();
    batch.getAnalysis().path("confirmedDecisions").forEach(decision -> {
      if (action.equals(decision.path("action").asText())) {
        labels.put(
            DataImportWorkTypeMapping.normalize(decision.path("sourceLabel").asText()),
            decision.path("absenceType").isTextual()
                ? decision.path("absenceType").asText() : "");
      }
    });
    Map<Integer, String> result = new HashMap<>();
    headerColumns(sheet).forEach((column, label) -> {
      String value = labels.get(DataImportWorkTypeMapping.normalize(label));
      if (value != null) result.put(column, value);
    });
    return result;
  }

  private Map<String, String> decisionMarkers(DataImportBatch batch, String action) {
    Map<String, String> result = new HashMap<>();
    Map<String, JsonNode> candidates = new HashMap<>();
    batch.getAnalysis().path("workTypeCandidates").forEach(candidate -> {
      if (candidate.path("markerCandidate").asBoolean()) {
        candidates.put(DataImportWorkTypeMapping.normalize(
            candidate.path("sourceLabel").asText()), candidate);
      }
    });
    batch.getAnalysis().path("confirmedDecisions").forEach(decision -> {
      String label = DataImportWorkTypeMapping.normalize(
          decision.path("sourceLabel").asText());
      if (candidates.containsKey(label) && action.equals(decision.path("action").asText())) {
        result.put(label, decision.path("absenceType").isTextual()
            ? decision.path("absenceType").asText() : "");
      }
    });
    return result;
  }

  private Map<String, AbsenceImportRule> absenceRules(DataImportBatch batch) {
    Map<String, AbsenceImportRule> result = new HashMap<>();
    batch.getAnalysis().path("confirmedDecisions").forEach(decision -> {
      if (!"IMPORT_AS_ABSENCE".equals(decision.path("action").asText())) return;
      String label = DataImportWorkTypeMapping.normalize(
          decision.path("sourceLabel").asText());
      result.put(label, new AbsenceImportRule(
          decision.path("absenceType").asText(),
          decision.path("absencePaid").asBoolean(false),
          decision.path("absencePaidMinutesPerDay").asInt(0)));
    });
    return result;
  }

  private Map<Integer, String> headerColumns(JsonNode sheet) {
    Map<Integer, String> headers = new LinkedHashMap<>();
    JsonNode rows = sheet.path("rows");
    for (int index = 0; index < Math.min(10, rows.size()); index++) {
      JsonNode row = rows.get(index);
      if (day(row) != null || explicitDate(row) != null) break;
      row.path("cells").forEach(cell -> {
        if ("STRING".equals(cell.path("type").asText())) {
          headers.put(cell.path("column").asInt(), cell.path("display").asText().trim());
        }
      });
    }
    return headers;
  }

  private boolean isHeader(String text, JsonNode sheet) {
    String normalized = DataImportWorkTypeMapping.normalize(text);
    return headerColumns(sheet).values().stream()
        .map(DataImportWorkTypeMapping::normalize).anyMatch(normalized::equals);
  }

  private Integer day(JsonNode row) {
    for (JsonNode cell : row.path("cells")) {
      if (cell.path("column").asInt() == 1 && cell.path("number").isNumber()) {
        int value = cell.path("number").asInt();
        if (value >= 1 && value <= 31) return value;
      }
    }
    return null;
  }

  private LocalDate explicitDate(JsonNode row) {
    for (JsonNode cell : row.path("cells")) {
      if (cell.path("column").asInt() != 1) continue;
      String value = cell.path("display").asText().trim();
      for (var formatter : List.of(
          java.time.format.DateTimeFormatter.ofPattern("d.M.uuuu"),
          java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)) {
        try {
          return LocalDate.parse(value, formatter);
        } catch (java.time.format.DateTimeParseException ignored) {
          // Try the next supported exact-date format.
        }
      }
    }
    return null;
  }

  private String entryId(JsonNode sheet, JsonNode row) {
    return sheet.path("name").asText().replace(":", "_") + ":" + row.path("row").asInt();
  }

  private record AbsenceImportRule(String type, boolean paid, int paidMinutesPerDay) {}

  private DataImportBatch requireReadyBatch(UUID id, UUID userId) {
    DataImportBatch batch = batches.findByIdAndUserId(id, userId)
        .orElseThrow(() -> new IllegalArgumentException("Import batch was not found"));
    if (batch.getStatus() != DataImportStatus.READY
        && batch.getStatus() != DataImportStatus.IMPORTED) {
      throw new IllegalArgumentException("Confirm work types before previewing work entries");
    }
    if (batch.getEmployment() == null) {
      throw new IllegalArgumentException("Work entries require one confirmed employment");
    }
    return batch;
  }

  private int inferYear(String text) {
    var matcher = YEAR.matcher(text);
    if (!matcher.find()) {
      throw new IllegalArgumentException("Include the year in the filename");
    }
    return Integer.parseInt(matcher.group(1));
  }

  private int inferMonth(String text) {
    String value = text.toLowerCase(Locale.ROOT);
    List<Set<String>> months = List.of(
        MONTH_1, MONTH_2, MONTH_3, MONTH_4, MONTH_5, MONTH_6,
        MONTH_7, MONTH_8, MONTH_9, MONTH_10, MONTH_11, MONTH_12);
    for (int index = 0; index < months.size(); index++) {
      if (months.get(index).stream().anyMatch(value::contains)) return index + 1;
    }
    return 0;
  }
}
