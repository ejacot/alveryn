package com.alveryn.api.dataimport.intelligence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Slf4j
@Service
public class ImportIntelligenceService {
  private static final String SYSTEM_PROMPT = """
      You classify imported work-history columns. You are not an autonomous agent.
      Use only the supplied evidence. Never invent a rate, percentage, date, or work type.
      A numeric column may be an activity, surcharge-hours marker, absence, total, or metadata.
      Prefer UNKNOWN with a concise user question when evidence is insufficient.
      Return one classification for every supplied candidate.
      """;

  private final ImportIntelligenceProperties properties;
  private final ObjectMapper objectMapper;
  private final RestClient restClient;

  public ImportIntelligenceService(
      ImportIntelligenceProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    var requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(properties.timeout());
    requestFactory.setReadTimeout(properties.timeout());
    this.restClient = RestClient.builder()
        .baseUrl(properties.baseUrl())
        .requestFactory(requestFactory)
        .build();
  }

  public Outcome enrich(ObjectNode analysis) {
    if (!properties.available()) {
      analysis.putObject("ai").put("status", "DISABLED");
      return new Outcome(false, "DISABLED");
    }
    ArrayNode candidates = analysis.withArray("workTypeCandidates");
    List<Map<String, Object>> uncertain = objectMapper.convertValue(
        candidates, new TypeReference<>() {});
    uncertain = uncertain.stream()
        .filter(item -> ((Number) item.getOrDefault("confidence", 0)).doubleValue() < 0.9)
        .map(this::minimalCandidate)
        .toList();
    if (uncertain.isEmpty()) {
      analysis.putObject("ai").put("status", "NOT_NEEDED");
      return new Outcome(false, "NOT_NEEDED");
    }

    try {
      String request = objectMapper.writeValueAsString(requestBody(uncertain));
      String rawResponse = restClient.post()
          .uri("/chat/completions")
          .contentType(MediaType.APPLICATION_JSON)
          .headers(headers -> headers.setBearerAuth(properties.apiKey()))
          .body(request)
          .retrieve()
          .body(String.class);
      JsonNode envelope = objectMapper.readTree(rawResponse);
      String content = envelope.path("choices").path(0).path("message").path("content").asText();
      JsonNode classifications = objectMapper.readTree(content).path("classifications");
      merge(candidates, classifications);
      analysis.putObject("ai")
          .put("status", "COMPLETED")
          .put("model", properties.model())
          .put("reviewRequired", true);
      return new Outcome(true, "COMPLETED");
    } catch (Exception exception) {
      log.warn("Import intelligence unavailable; deterministic analysis will be used: {}",
          exception.getMessage());
      analysis.putObject("ai").put("status", "FALLBACK");
      return new Outcome(false, "FALLBACK");
    }
  }

  public ObjectNode analyzePayrollText(String text, ArrayNode candidates) {
    if (!properties.available()) return unavailablePayrollResult();
    String sanitized = text.length() > 30_000 ? text.substring(0, 30_000) : text;
    return requestPayrollEvidence(
        List.of(Map.of("type", "text", "text",
            payrollPrompt(candidates) + "\nPAYROLL TEXT:\n" + sanitized)),
        properties.model());
  }

  public ObjectNode analyzePayrollImages(List<String> imageDataUrls, ArrayNode candidates) {
    if (!properties.available()) return unavailablePayrollResult();
    ObjectNode combined = objectMapper.createObjectNode();
    ArrayNode findings = combined.putArray("findings");
    combined.put("status", "COMPLETED");
    for (int start = 0; start < imageDataUrls.size(); start += 3) {
      List<Map<String, Object>> content = new ArrayList<>();
      content.add(Map.of("type", "text", "text", payrollPrompt(candidates)));
      imageDataUrls.subList(start, Math.min(start + 3, imageDataUrls.size()))
          .forEach(url -> content.add(Map.of(
              "type", "image_url", "image_url", Map.of("url", url))));
      ObjectNode part = requestPayrollEvidence(content, properties.visionModel());
      part.path("findings").forEach(findings::add);
      if (!"COMPLETED".equals(part.path("status").asText())) {
        combined.put("status", "FALLBACK");
      }
    }
    return combined;
  }

  public ObjectNode analyzeMonthlyPayrollImages(
      List<String> imageDataUrls, int year, int month) {
    if (!properties.available()) return unavailablePayrollResult();
    if (imageDataUrls == null || imageDataUrls.isEmpty()) return unavailablePayrollResult();

    ObjectNode singlePageCandidate = null;
    for (int page = 0; page < imageDataUrls.size(); page++) {
      ObjectNode result = analyzeMonthlyPayrollPage(
          imageDataUrls.get(page), year, month, page + 1);
      if (!"COMPLETED".equals(result.path("status").asText())) continue;

      boolean exactPeriod = result.path("year").asInt(-1) == year
          && result.path("month").asInt(-1) == month;
      if (exactPeriod && hasMonthlyPayrollValues(result)) return result;

      // A photo can be tightly cropped and omit the period header. It is still useful when
      // the user deliberately uploaded one image, but never use it to choose a PDF page.
      if (imageDataUrls.size() == 1
          && result.path("year").isNull()
          && result.path("month").isNull()
          && hasMonthlyPayrollValues(result)) {
        singlePageCandidate = result;
      }
    }
    if (singlePageCandidate != null) {
      singlePageCandidate.put("year", year);
      singlePageCandidate.put("month", month);
      singlePageCandidate.put("periodInferredFromCalendar", true);
      return singlePageCandidate;
    }

    ObjectNode unavailable = unavailablePayrollResult();
    unavailable.put("message",
        "No payroll page matching %d-%02d was found".formatted(year, month));
    return unavailable;
  }

  private ObjectNode analyzeMonthlyPayrollPage(
      String imageDataUrl, int year, int month, int pageNumber) {
    try {
      List<Map<String, Object>> content = new ArrayList<>();
      content.add(Map.of("type", "text", "text", """
          Analyze only this single page of a German payroll document.

          STEP 1 — PERIOD
          Read the printed payroll period (Abrechnungsmonat/Zeitraum) from the page.
          The requested Calendar period is %d-%02d. If this page belongs to another period,
          return its printed year and month, confidence 0, and null for every other field.
          Never copy figures from a different month.

          STEP 2 — RELEVANT AREA
          If the period matches, read only the earnings table, usually headed
          "Lohnart / Bezeichnung / bezahlte Menge / Faktor / Betrag", plus "Gesamtbrutto".
          Ignore identity, address, bank, tax, social insurance, deductions and net pay.

          STEP 3 — EXTRACTION
          Extract printed values only; never guess a missing value:
          - normal*: ordinary worked hours, hourly rate and amount.
          - absence*: Urlaub, Krankheit or another paid absence, including printed days/hours,
            rate and amount.
          - extra*: Zuschlag/Sonntag/Feiertag/Nacht. If one surcharge is split into taxable
            and tax-free rows with the same eligible hours, report those hours only once and
            sum the printed surcharge amounts.
          - payrollLines: transcribe EVERY row from the earnings table, in printed order. Each
            object must contain code, label, quantity, factor, percentage, grossRelevant and
            amount. grossRelevant is true for printed GB*=J, false for GB*=N, otherwise null.
            Read grossRelevant ONLY from the rightmost GB* column. F in St* or SV* means
            tax/social-insurance free and does NOT mean grossRelevant=false.
            Use null for a cell that is blank. Keep taxable and tax-free rows separate. Do not
            calculate or merge rows. Do not include tax, social insurance, deductions or
            net-payment rows.
          - grossAmount: the printed Gesamtbrutto for the month.
          Decimal commas are decimal separators, not thousands separators.
          Return every field required by the JSON schema; use null when not printed.
          """.formatted(year, month)));
      content.add(Map.of(
          "type", "image_url", "image_url", Map.of("url", imageDataUrl)));
      Map<String, Object> body = Map.of(
          "model", properties.visionModel(),
          "temperature", 0.0,
          "max_completion_tokens", 1000,
          "reasoning_effort", "none",
          "messages", List.of(
              Map.of("role", "system", "content",
                  """
                  You extract payroll figures. Never invent data. Return one valid JSON object
                  only, with exactly these keys:
                  year, month, normalHours, normalRate, normalAmount, absenceLabel, absenceDays,
                  absenceHours, absenceRate, absenceAmount, extraHours, extraAmount, grossAmount,
                  confidence, payrollLines. Each payrollLines item must contain code, label,
                  quantity, factor, percentage, grossRelevant and amount. Use null for
                  unavailable values and [] when there are no earnings rows. Do not use markdown.
                  """),
              Map.of("role", "user", "content", content)),
          "response_format", Map.of("type", "json_object"));
      String raw = restClient.post().uri("/chat/completions")
          .contentType(MediaType.APPLICATION_JSON)
          .headers(headers -> headers.setBearerAuth(properties.apiKey()))
          .body(objectMapper.writeValueAsString(body)).retrieve().body(String.class);
      String modelContent = objectMapper.readTree(raw)
          .path("choices").path(0).path("message").path("content").asText();
      if (modelContent.isBlank()) {
        String finishReason = objectMapper.readTree(raw)
            .path("choices").path(0).path("finish_reason").asText("unknown");
        throw new IllegalArgumentException(
            "Payroll model returned an empty answer (finish reason: " + finishReason + ")");
      }
      JsonNode parsed = parseJsonObject(modelContent);
      if (!parsed.isObject()) {
        throw new IllegalArgumentException("Payroll model returned an invalid response");
      }
      ObjectNode result = (ObjectNode) parsed;
      normalizeMonthlyPayrollResult(result);
      aggregatePayrollLines(result);
      result.put("status", "COMPLETED");
      result.put("sourcePage", pageNumber);
      return result;
    } catch (Exception exception) {
      log.warn("Monthly payroll page {} analysis unavailable: {}",
          pageNumber, exception.getMessage());
      return unavailablePayrollResult();
    }
  }

  private boolean hasMonthlyPayrollValues(ObjectNode result) {
    return result.path("normalHours").isNumber()
        || result.path("normalAmount").isNumber()
        || result.path("absenceAmount").isNumber()
        || result.path("extraAmount").isNumber()
        || result.path("grossAmount").isNumber();
  }

  private void normalizeMonthlyPayrollResult(ObjectNode result) {
    List<String> numericFields = List.of(
        "normalHours", "normalRate", "normalAmount", "absenceDays", "absenceHours",
        "absenceRate", "absenceAmount", "extraHours", "extraAmount", "grossAmount");
    numericFields.forEach(field -> {
      if (!result.path(field).isNumber()) result.putNull(field);
    });
    if (!result.path("year").isIntegralNumber()) result.putNull("year");
    if (!result.path("month").isIntegralNumber()) result.putNull("month");
    if (!result.path("absenceLabel").isTextual()) result.putNull("absenceLabel");
    double confidence = result.path("confidence").isNumber()
        ? result.path("confidence").asDouble() : 0;
    result.put("confidence", Math.max(0, Math.min(1, confidence)));
  }

  private void aggregatePayrollLines(ObjectNode result) {
    JsonNode lines = result.path("payrollLines");
    if (!lines.isArray() || lines.isEmpty()) return;

    Map<String, BigDecimal> hoursBySurcharge = new java.util.LinkedHashMap<>();
    BigDecimal totalAmount = BigDecimal.ZERO;
    boolean foundAmount = false;
    BigDecimal calculatedGross = BigDecimal.ZERO;
    boolean foundGrossLine = false;
    for (JsonNode line : lines) {
      String label = line.path("label").asText("");
      if (line.path("amount").isNumber()) {
        calculatedGross = calculatedGross.add(line.path("amount").decimalValue());
        foundGrossLine = true;
      }
      if (!isSurcharge(label)) continue;
      String group = surchargeGroup(line);
      if (line.path("quantity").isNumber()) {
        BigDecimal hours = line.path("quantity").decimalValue();
        hoursBySurcharge.merge(group, hours, BigDecimal::max);
      }
      if (line.path("amount").isNumber()) {
        totalAmount = totalAmount.add(line.path("amount").decimalValue());
        foundAmount = true;
      }
    }
    if (!hoursBySurcharge.isEmpty()) {
      result.put("extraHours", hoursBySurcharge.values().stream()
          .reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    if (foundAmount) result.put("extraAmount", totalAmount);
    if (foundGrossLine) result.put("grossAmount", calculatedGross);
  }

  private boolean isSurcharge(String label) {
    String normalized = label.toLowerCase(java.util.Locale.ROOT);
    return normalized.contains("zuschlag")
        || normalized.contains("nacht")
        || normalized.contains("sonntag")
        || normalized.contains("feiertag");
  }

  private String normalizeSurchargeGroup(String label) {
    return label.toLowerCase(java.util.Locale.ROOT)
        .replaceAll("\\([^)]*\\)", " ")
        .replaceAll(
            "\\b(steuerfrei|steuerpflichtig|pflichtig|st\\.?\\s*frei|st\\.?\\s*pflichtig"
                + "|pfl\\.?|sv\\s*frei|sv\\s*pflichtig)\\b",
            " ")
        .replaceAll("\\s+", " ")
        .trim();
  }

  private String surchargeGroup(JsonNode line) {
    String label = line.path("label").asText("");
    String normalized = label.toLowerCase(java.util.Locale.ROOT);
    String category = normalized.contains("sonntag") ? "SUNDAY"
        : normalized.contains("feiertag") ? "HOLIDAY"
        : normalized.contains("nacht") ? "NIGHT"
        : normalizeSurchargeGroup(label);
    String percentage = line.path("percentage").isNumber()
        ? line.path("percentage").decimalValue().stripTrailingZeros().toPlainString()
        : percentageFromLabel(label);
    return category + ":" + percentage;
  }

  private String percentageFromLabel(String label) {
    var matcher = java.util.regex.Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*%").matcher(label);
    return matcher.find() ? matcher.group(1).replace(',', '.') : "";
  }

  private JsonNode parseJsonObject(String content) throws Exception {
    String candidate = content == null ? "" : content.trim();
    if (candidate.startsWith("```")) {
      int firstLineEnd = candidate.indexOf('\n');
      int closingFence = candidate.lastIndexOf("```");
      if (firstLineEnd >= 0 && closingFence > firstLineEnd) {
        candidate = candidate.substring(firstLineEnd + 1, closingFence).trim();
      }
    }
    try {
      return objectMapper.readTree(candidate);
    } catch (Exception ignored) {
      int start = candidate.indexOf('{');
      int end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return objectMapper.readTree(candidate.substring(start, end + 1));
      }
      throw new IllegalArgumentException("Payroll model did not return readable JSON");
    }
  }

  public ChatInterpretation interpretImportQuestion(
      String questionType,
      String sourceLabel,
      String sourceValue,
      String date,
      List<ChatLine> conversation,
      List<WorkLine> workLines) {
    if (!properties.available()) {
      return new ChatInterpretation(
          "UNAVAILABLE",
          "AI assistance is not configured. Please use the structured controls below.",
          null, null, null, null, null);
    }
    try {
      List<Map<String, Object>> messages = new ArrayList<>();
      messages.add(Map.of(
          "role", "system",
          "content", """
              You help a user resolve one ambiguous work-history import value.
              Interpret only; never save data. Never invent a percentage, duration, activity,
              date, or rule. Values in a surcharge column are eligible base hours, never
              additional worked hours. A surcharge must be attached to one supplied
              TIME_BASED work line and must not increase total worked time.
              Return NEEDS_CLARIFICATION if any required fact is missing. Ask one concise
              question at a time in the user's language.
              Return PROPOSAL only when the action can be represented exactly.
              For NEEDS_CLARIFICATION, set action to NONE and all proposal fields to null.
              """));
      messages.add(Map.of(
          "role", "user",
          "content", "Import context (authoritative JSON):\n" + writeJson(Map.of(
              "questionType", questionType,
              "sourceLabel", sourceLabel == null ? "" : sourceLabel,
              "sourceValue", sourceValue,
              "date", date,
              "allowedActions", List.of(
                  "ENTER_PERCENTAGE", "ADD_AS_NOTE", "USE_AS_INTERVAL", "IGNORE"),
              "workLines", workLines))));
      for (ChatLine line : conversation) {
        messages.add(Map.of(
            "role", line.role().equals("USER") ? "user" : "assistant",
            "content", line.content()));
      }
      Map<String, Object> body = Map.of(
          "model", properties.model(),
          "temperature", 0.1,
          "max_completion_tokens", 1200,
          "messages", messages,
          "response_format", Map.of(
              "type", "json_schema",
              "json_schema", Map.of(
                  "name", "import_question_resolution",
                  "strict", true,
                  "schema", chatResponseSchema())));
      String rawResponse = restClient.post()
          .uri("/chat/completions")
          .contentType(MediaType.APPLICATION_JSON)
          .headers(headers -> headers.setBearerAuth(properties.apiKey()))
          .body(objectMapper.writeValueAsString(body))
          .retrieve()
          .body(String.class);
      JsonNode parsed = objectMapper.readTree(objectMapper.readTree(rawResponse)
          .path("choices").path(0).path("message").path("content").asText());
      return new ChatInterpretation(
          parsed.path("status").asText("NEEDS_CLARIFICATION"),
          parsed.path("message").asText(),
          nullableText(parsed, "action"),
          nullableDecimal(parsed, "percentage"),
          nullableUuid(parsed, "targetWorkTypeId"),
          nullableDecimal(parsed, "eligibleHours"),
          nullableText(parsed, "confirmation"));
    } catch (Exception exception) {
      log.warn("Import question assistance unavailable: {}", exception.getMessage());
      return new ChatInterpretation(
          "UNAVAILABLE",
          "AI assistance is temporarily unavailable. Please use the structured controls below.",
          null, null, null, null, null);
    }
  }

  private Map<String, Object> chatResponseSchema() {
    return Map.of(
        "type", "object",
        "additionalProperties", false,
        "properties", Map.of(
            "status", Map.of("type", "string",
                "enum", List.of("NEEDS_CLARIFICATION", "PROPOSAL")),
            "message", Map.of("type", "string"),
            "action", Map.of("type", "string", "enum", List.of(
                "NONE", "ENTER_PERCENTAGE", "ADD_AS_NOTE", "USE_AS_INTERVAL", "IGNORE")),
            "percentage", Map.of("type", List.of("number", "null"),
                "exclusiveMinimum", 0, "maximum", 1000),
            "targetWorkTypeId", Map.of("type", List.of("string", "null")),
            "eligibleHours", Map.of("type", List.of("number", "null"),
                "exclusiveMinimum", 0),
            "confirmation", Map.of("type", List.of("string", "null"))),
        "required", List.of(
            "status", "message", "action", "percentage",
            "targetWorkTypeId", "eligibleHours", "confirmation"));
  }

  private String nullableText(JsonNode node, String field) {
    return node.path(field).isNull() || node.path(field).isMissingNode()
        ? null : node.path(field).asText();
  }

  private UUID nullableUuid(JsonNode node, String field) {
    try {
      String value = nullableText(node, field);
      return value == null ? null : UUID.fromString(value);
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  private BigDecimal nullableDecimal(JsonNode node, String field) {
    return node.path(field).isNumber() ? node.path(field).decimalValue() : null;
  }

  private ObjectNode requestPayrollEvidence(
      List<Map<String, Object>> userContent, String model) {
    try {
      Map<String, Object> body = Map.of(
          "model", model,
          "temperature", 0.1,
          "max_completion_tokens", 2500,
          "messages", List.of(
              Map.of("role", "system", "content",
                  "Extract payroll calculation evidence. Never infer a percentage or rate "
                      + "that is not printed or mathematically demonstrated. Return JSON only."),
              Map.of("role", "user", "content", userContent)),
          "response_format", Map.of("type", "json_object"));
      String rawResponse = restClient.post()
          .uri("/chat/completions")
          .contentType(MediaType.APPLICATION_JSON)
          .headers(headers -> headers.setBearerAuth(properties.apiKey()))
          .body(objectMapper.writeValueAsString(body))
          .retrieve()
          .body(String.class);
      String content = objectMapper.readTree(rawResponse)
          .path("choices").path(0).path("message").path("content").asText();
      JsonNode parsed = objectMapper.readTree(content);
      ObjectNode result = objectMapper.createObjectNode();
      result.put("status", "COMPLETED");
      result.set("findings", parsed.path("findings").isArray()
          ? parsed.path("findings") : objectMapper.createArrayNode());
      return result;
    } catch (Exception exception) {
      log.warn("Payroll evidence analysis unavailable: {}", exception.getMessage());
      return unavailablePayrollResult();
    }
  }

  private String payrollPrompt(ArrayNode candidates) {
    List<String> labels = new ArrayList<>();
    candidates.forEach(candidate -> labels.add(candidate.path("sourceLabel").asText()));
    return """
        Read this salary statement and find evidence that clarifies the Excel labels below.
        Focus only on work compensation: normal hourly rates, per-unit rates, surcharge
        percentages, eligible hours, and calculation bases. Ignore identity, address,
        bank, tax, insurance, deductions, and net salary. A percentage must be explicitly
        printed or unambiguously demonstrated by base, hours and amount. If uncertain,
        omit it. Return exactly:
        {"findings":[{"sourceLabel":"label from list","semanticRole":"SURCHARGE|ACTIVITY_TIME|ACTIVITY_UNIT","percentage":number|null,"hourlyRate":number|null,"ratePerUnit":number|null,"period":"string or null","confidence":number,"reason":"short evidence without personal data"}]}
        Candidate labels:
        """ + writeJson(labels);
  }

  private ObjectNode unavailablePayrollResult() {
    ObjectNode result = objectMapper.createObjectNode();
    result.put("status", properties.available() ? "FALLBACK" : "DISABLED");
    result.putArray("findings");
    return result;
  }

  private Map<String, Object> minimalCandidate(Map<String, Object> candidate) {
    return Map.of(
        "sourceLabel", candidate.getOrDefault("sourceLabel", ""),
        "occurrences", candidate.getOrDefault("occurrences", 0),
        "samples", candidate.getOrDefault("samples", List.of()),
        "deterministicSuggestion", candidate.getOrDefault("suggestedCalculationType", "UNKNOWN"),
        "deterministicReason", candidate.getOrDefault("reason", ""));
  }

  private Map<String, Object> requestBody(List<Map<String, Object>> candidates) {
    Map<String, Object> schema = responseSchema();
    return Map.of(
        "model", properties.model(),
        "temperature", 0.1,
        "max_completion_tokens", 2500,
        "messages", List.of(
            Map.of("role", "system", "content", SYSTEM_PROMPT),
            Map.of("role", "user", "content",
                "Classify this anonymized import evidence:\n"
                    + writeJson(Map.of("candidates", candidates)))),
        "response_format", Map.of(
            "type", "json_schema",
            "json_schema", Map.of(
                "name", "work_import_classification",
                "strict", true,
                "schema", schema)));
  }

  private Map<String, Object> responseSchema() {
    Map<String, Object> item = Map.of(
        "type", "object",
        "additionalProperties", false,
        "properties", Map.of(
            "sourceLabel", Map.of("type", "string"),
            "semanticRole", Map.of("type", "string", "enum", List.of(
                "ACTIVITY_TIME", "ACTIVITY_UNIT", "SURCHARGE", "ABSENCE", "IGNORE", "UNKNOWN")),
            "confidence", Map.of("type", "number"),
            "reason", Map.of("type", "string"),
            "question", Map.of("type", List.of("string", "null"))),
        "required", List.of("sourceLabel", "semanticRole", "confidence", "reason", "question"));
    return Map.of(
        "type", "object",
        "additionalProperties", false,
        "properties", Map.of("classifications", Map.of("type", "array", "items", item)),
        "required", List.of("classifications"));
  }

  private void merge(ArrayNode candidates, JsonNode classifications) {
    if (!classifications.isArray()) return;
    for (JsonNode classification : classifications) {
      String label = classification.path("sourceLabel").asText();
      for (JsonNode candidateNode : candidates) {
        ObjectNode candidate = (ObjectNode) candidateNode;
        if (!candidate.path("sourceLabel").asText().equalsIgnoreCase(label)) continue;
        if (candidate.path("markerCandidate").asBoolean()) continue;
        double confidence = Math.max(0, Math.min(1, classification.path("confidence").asDouble()));
        String role = classification.path("semanticRole").asText("UNKNOWN");
        candidate.put("semanticRole", role);
        candidate.put("aiConfidence", confidence);
        candidate.put("aiReason", classification.path("reason").asText());
        if (confidence >= 0.7 && "ACTIVITY_TIME".equals(role)) {
          candidate.put("suggestedCalculationType", "TIME_BASED");
          candidate.put("suggestedCompensationMethod", "HOURLY");
        } else if (confidence >= 0.7 && "ACTIVITY_UNIT".equals(role)) {
          candidate.put("suggestedCalculationType", "UNIT_BASED");
          candidate.put("suggestedCompensationMethod", "PER_UNIT");
        }
        if (!classification.path("question").isNull()) {
          candidate.put("aiQuestion", classification.path("question").asText());
        }
      }
    }
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not prepare anonymized import evidence", exception);
    }
  }

  public record Outcome(boolean used, String status) {}

  public record ChatLine(String role, String content) {}

  public record WorkLine(
      UUID workTypeId, String workTypeName, String calculationMethod, BigDecimal hours) {}

  public record ChatInterpretation(
      String status,
      String message,
      String action,
      BigDecimal percentage,
      UUID targetWorkTypeId,
      BigDecimal eligibleHours,
      String confirmation) {}
}
