package com.alveryn.api.dataimport.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.dataimport.dto.DataImportAnalysisResponse;
import com.alveryn.api.dataimport.dto.DataImportCandidateDecision;
import com.alveryn.api.dataimport.dto.DataImportConfirmRequest;
import com.alveryn.api.dataimport.dto.DataImportConfirmResponse;
import com.alveryn.api.dataimport.dto.DataImportPeriodRequest;
import com.alveryn.api.dataimport.entity.DataImportBatch;
import com.alveryn.api.dataimport.entity.DataImportWorkTypeMapping;
import com.alveryn.api.dataimport.entity.DataImportStatus;
import com.alveryn.api.dataimport.entity.DataImportScope;
import com.alveryn.api.dataimport.repository.DataImportBatchRepository;
import com.alveryn.api.dataimport.repository.DataImportWorkTypeMappingRepository;
import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.worktype.service.WorkTypeService;
import com.alveryn.api.worktype.dto.CreateWorkTypeRequest;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.absence.service.AbsenceTypeSettingService;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import java.util.Map;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class DataImportService {
  private static final long MAX_SIZE = 10L * 1024 * 1024;

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserAccountRepository userAccountRepository;
  private final DataImportBatchRepository batchRepository;
  private final DataImportWorkTypeMappingRepository mappingRepository;
  private final EmploymentRepository employmentRepository;
  private final WorkTypeRepository workTypeRepository;
  private final XlsxWorkbookAnalyzer analyzer;
  private final TextWorkLogConverter textWorkLogConverter;
  private final VisualWorkLogConverter visualWorkLogConverter;
  private final ObjectMapper objectMapper;
  private final ImportIntelligenceService importIntelligenceService;
  private final PayrollDocumentAnalyzer payrollDocumentAnalyzer;
  private final WorkTypeService workTypeService;
  private final AbsenceTypeSettingService absenceTypeSettingService;

  @Transactional
  public DataImportAnalysisResponse analyze(
      MultipartFile file, DataImportScope scope, UUID employmentId) {
    return analyze(file, List.of(), scope, employmentId);
  }

  @Transactional
  public DataImportAnalysisResponse analyze(
      MultipartFile file, List<MultipartFile> payrollFiles,
      DataImportScope scope, UUID employmentId) {
    validate(file);
    if (scope == null) throw new IllegalArgumentException("Import scope is required");
    try {
      byte[] sourceBytes = file.getBytes();
      boolean convertedDocument = isTextFile(file) || isVisualFile(file);
      byte[] bytes = isTextFile(file) ? textWorkLogConverter.convert(sourceBytes)
          : isVisualFile(file) ? visualWorkLogConverter.convert(file) : sourceBytes;
      var digest = MessageDigest.getInstance("SHA-256");
      digest.update(sourceBytes);
      if (payrollFiles != null) {
        for (MultipartFile payroll : payrollFiles) digest.update(payroll.getBytes());
      }
      String hash = HexFormat.of().formatHex(digest.digest());
      var userId = authenticatedUserAccessor.requireUserId();
      Employment employment = resolveEmployment(scope, employmentId, userId);
      var existing = batchRepository.findByUserIdAndSourceSha256(userId, hash);
      if (existing.isPresent()) {
        var batch = existing.get();
        if (batch.getImportScope() != scope
            || !java.util.Objects.equals(
                batch.getEmployment() == null ? null : batch.getEmployment().getId(), employmentId)) {
          throw new IllegalArgumentException(
              "This workbook was already analyzed with a different employment selection");
        }
        if (batch.getAnalysis().path("analyzerVersion").asInt() < analyzer.version()) {
          var refreshed = analyzeAndEnrich(
              bytes, payrollFiles, scope, employmentId, userId, convertedDocument);
          batch.refreshAnalysis(
              refreshed.requiresReview() ? DataImportStatus.NEEDS_REVIEW : DataImportStatus.ANALYZED,
              refreshed.workbookData(), refreshed.analysis());
        }
        return response(batch, true);
      }

      var result = analyzeAndEnrich(
          bytes, payrollFiles, scope, employmentId, userId, convertedDocument);
      var user = userAccountRepository.findById(userId)
          .orElseThrow(() -> new IllegalArgumentException("Authenticated user no longer exists"));
      String filename = safeFilename(file.getOriginalFilename());
      DataImportStatus status =
          result.requiresReview() ? DataImportStatus.NEEDS_REVIEW : DataImportStatus.ANALYZED;
      var batch = batchRepository.save(DataImportBatch.analyzed(
          user, filename, hash, sourceBytes.length,
          file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
          sourceBytes, status, scope, employment,
          result.workbookData(), result.analysis()));
      return response(batch, false);
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not read the uploaded workbook", exception);
    }
  }

  private XlsxWorkbookAnalyzer.Result analyzeAndEnrich(
      byte[] bytes, List<MultipartFile> payrollFiles,
      DataImportScope scope, UUID employmentId, UUID userId, boolean explicitDates) {
    var result = analyzer.analyze(bytes);
    if (explicitDates) {
      ((com.fasterxml.jackson.databind.node.ObjectNode) result.analysis())
          .put("datesAreExplicit", true);
    }
    var applicableWorkTypes = workTypeRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId)
        .stream()
        .filter(type -> scope == DataImportScope.MULTIPLE
            || type.getEmployment() == null
            || type.getEmployment().getId().equals(employmentId))
        .toList();
    analyzer.matchExistingWorkTypes(result.analysis(), applicableWorkTypes);
    applySavedMappings(result.analysis(), userId, scope, employmentId);
    importIntelligenceService.enrich((com.fasterxml.jackson.databind.node.ObjectNode) result.analysis());
    var analysis = (com.fasterxml.jackson.databind.node.ObjectNode) result.analysis();
    var payrollEvidence = payrollDocumentAnalyzer.analyze(
        payrollFiles, analysis.withArray("workTypeCandidates"));
    analysis.set("payrollEvidence", payrollEvidence);
    mergePayrollEvidence(analysis, payrollEvidence);
    return result;
  }

  private void mergePayrollEvidence(
      com.fasterxml.jackson.databind.node.ObjectNode analysis,
      com.fasterxml.jackson.databind.node.ObjectNode payrollEvidence) {
    Map<String, com.fasterxml.jackson.databind.node.ObjectNode> candidates = new java.util.HashMap<>();
    analysis.withArray("workTypeCandidates").forEach(node -> candidates.put(
        DataImportWorkTypeMapping.normalize(node.path("sourceLabel").asText()),
        (com.fasterxml.jackson.databind.node.ObjectNode) node));
    payrollEvidence.path("findings").forEach(finding -> {
      if (finding.path("confidence").asDouble(0) < 0.7) return;
      var candidate = candidates.get(DataImportWorkTypeMapping.normalize(
          finding.path("sourceLabel").asText()));
      if (candidate == null) return;
      String role = finding.path("semanticRole").asText();
      candidate.put("payrollConfidence", finding.path("confidence").asDouble());
      candidate.put("payrollReason", finding.path("reason").asText());
      if (!finding.path("period").isNull()) {
        candidate.put("payrollPeriod", finding.path("period").asText());
      }
      if ("SURCHARGE".equals(role) && finding.path("percentage").isNumber()) {
        candidate.put("semanticRole", "SURCHARGE");
        candidate.put("suggestedAction", "CONFIGURE_SURCHARGE");
        candidate.put("extraPayPercentage", finding.path("percentage").decimalValue());
      } else if ("ACTIVITY_TIME".equals(role) && finding.path("hourlyRate").isNumber()) {
        candidate.put("suggestedCalculationType", "TIME_BASED");
        candidate.put("suggestedCompensationMethod", "HOURLY");
        candidate.put("suggestedHourlyRate", finding.path("hourlyRate").decimalValue());
      } else if ("ACTIVITY_UNIT".equals(role) && finding.path("ratePerUnit").isNumber()) {
        candidate.put("suggestedCalculationType", "UNIT_BASED");
        candidate.put("suggestedCompensationMethod", "PER_UNIT");
        candidate.put("suggestedRatePerUnit", finding.path("ratePerUnit").decimalValue());
      }
    });
  }

  private void applySavedMappings(
      com.fasterxml.jackson.databind.JsonNode analysis,
      UUID userId,
      DataImportScope scope,
      UUID employmentId) {
    if (scope != DataImportScope.SINGLE || employmentId == null) return;
    Map<String, DataImportWorkTypeMapping> mappings = mappingRepository
        .findAllByUserIdAndEmploymentId(userId, employmentId).stream()
        .collect(java.util.stream.Collectors.toMap(
            DataImportWorkTypeMapping::getNormalizedSourceLabel, mapping -> mapping));
    for (var candidate : analysis.path("workTypeCandidates")) {
      if (candidate.path("markerCandidate").asBoolean()) continue;
      var mapping = mappings.get(DataImportWorkTypeMapping.normalize(
          candidate.path("sourceLabel").asText()));
      if (mapping == null) continue;
      var node = (com.fasterxml.jackson.databind.node.ObjectNode) candidate;
      if (mapping.getSemanticRole() == DataImportWorkTypeMapping.SemanticRole.SURCHARGE) {
        node.put("suggestedAction", "CONFIGURE_SURCHARGE");
        node.put("semanticRole", "SURCHARGE");
        node.put("extraPayPercentage", mapping.getExtraPayPercentage());
        if (mapping.getWorkType() != null) {
          node.put("matchedWorkTypeId", mapping.getWorkType().getId().toString());
          node.put("matchedWorkTypeName", mapping.getWorkType().getName());
        }
        node.put("confidence", 1.0);
        node.put("reason", "A previous import confirmed this label as an extra-pay rule");
        continue;
      }
      if (mapping.getWorkType() == null || !mapping.getWorkType().isActive()) continue;
      var workType = mapping.getWorkType();
      node.put("suggestedAction", "MATCH_EXISTING");
      node.put("matchedWorkTypeId", workType.getId().toString());
      node.put("matchedWorkTypeName", workType.getName());
      node.put("suggestedCalculationType", workType.getCalculationMethod().name());
      node.put("suggestedCompensationMethod", workType.getCompensationMethod().name());
      node.put("confidence", 1.0);
      node.put("reason", "A previous import mapped this label to the same work type");
    }
  }

  @Transactional
  public DataImportConfirmResponse confirm(UUID batchId, DataImportConfirmRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    DataImportBatch batch = batchRepository.findByIdAndUserId(batchId, userId)
        .orElseThrow(() -> new IllegalArgumentException("Import batch was not found"));
    if (batch.getStatus() == DataImportStatus.READY
        || batch.getStatus() == DataImportStatus.IMPORTED) {
      throw new IllegalArgumentException("This import configuration was already confirmed");
    }
    if (batch.getEmployment() == null) {
      throw new IllegalArgumentException(
          "Confirm each employment separately before creating work types");
    }

    Map<String, com.fasterxml.jackson.databind.JsonNode> detected = new java.util.LinkedHashMap<>();
    batch.getAnalysis().path("workTypeCandidates").forEach(candidate ->
        detected.put(DataImportWorkTypeMapping.normalize(
            candidate.path("sourceLabel").asText()), candidate));
    Set<String> decided = new HashSet<>();
    List<DataImportConfirmResponse.Mapping> confirmed = new ArrayList<>();
    var decisionsJson = objectMapper.createArrayNode();
    int created = 0;
    int mapped = 0;
    int ignored = 0;

    for (DataImportCandidateDecision decision : request.candidates()) {
      String sourceKey = DataImportWorkTypeMapping.normalize(decision.sourceLabel());
      if (!decided.add(sourceKey) || !detected.containsKey(sourceKey)) {
        throw new IllegalArgumentException(
            "Every decision must reference one detected source label exactly once");
      }
      if (decision.action() == DataImportCandidateDecision.Action.IGNORE
          || decision.action() == DataImportCandidateDecision.Action.REVIEW_PER_ENTRY
          || decision.action() == DataImportCandidateDecision.Action.MARK_REST_DAY
          || decision.action() == DataImportCandidateDecision.Action.IMPORT_AS_ABSENCE) {
        if (decision.action() == DataImportCandidateDecision.Action.IMPORT_AS_ABSENCE
            && decision.absenceType() == null) {
          throw new IllegalArgumentException("Choose the absence type");
        }
        if (decision.action() == DataImportCandidateDecision.Action.IMPORT_AS_ABSENCE) {
          if (decision.absencePaid() == null) {
            throw new IllegalArgumentException(
                "Confirm whether the absence was paid in the imported period");
          }
          if (decision.absencePaid()
              && (decision.absencePaidMinutesPerDay() == null
                  || decision.absencePaidMinutesPerDay() <= 0)) {
            throw new IllegalArgumentException(
                "Enter the paid minutes per absence day for the imported period");
          }
          absenceTypeSettingService.ensureImportType(decision.absenceType());
        }
        ignored++;
        decisionsJson.add(objectMapper.valueToTree(decision));
        continue;
      }

      if (decision.action() == DataImportCandidateDecision.Action.CONFIGURE_SURCHARGE) {
        if (decision.extraPayPercentage() == null) {
          throw new IllegalArgumentException("Enter the extra-pay percentage");
        }
        var target = decision.workTypeId() == null ? null
            : resolveMappedWorkType(userId, batch.getEmployment().getId(), decision.workTypeId());
        var existingMapping = mappingRepository
            .findByUserIdAndEmploymentIdAndNormalizedSourceLabel(
                userId, batch.getEmployment().getId(), sourceKey);
        if (existingMapping.isPresent()) {
          existingMapping.get().remapSurcharge(
              target, decision.sourceLabel(), decision.extraPayPercentage());
        } else {
          mappingRepository.save(DataImportWorkTypeMapping.surcharge(
              batch.getUser(), batch.getEmployment(), target,
              decision.sourceLabel(), decision.extraPayPercentage()));
        }
        mapped++;
        confirmed.add(new DataImportConfirmResponse.Mapping(
            decision.sourceLabel(),
            "SURCHARGE",
            target == null ? null : target.getId(),
            target == null ? null : target.getName(),
            decision.extraPayPercentage()));
        decisionsJson.add(objectMapper.valueToTree(decision));
        continue;
      }

      var workType = decision.action() == DataImportCandidateDecision.Action.MATCH_EXISTING
          ? resolveMappedWorkType(userId, batch.getEmployment().getId(), decision.workTypeId())
          : createWorkType(batch, decision);
      if (decision.action() == DataImportCandidateDecision.Action.CREATE_NEW) created++;
      else mapped++;

      var existingMapping = mappingRepository
          .findByUserIdAndEmploymentIdAndNormalizedSourceLabel(
              userId, batch.getEmployment().getId(), sourceKey);
      if (existingMapping.isPresent()) {
        existingMapping.get().remap(workType, decision.sourceLabel());
      } else {
        mappingRepository.save(new DataImportWorkTypeMapping(
            batch.getUser(), batch.getEmployment(), workType, decision.sourceLabel()));
      }
      confirmed.add(new DataImportConfirmResponse.Mapping(
          decision.sourceLabel(), "ACTIVITY",
          workType.getId(), workType.getName(), null));
      decisionsJson.add(objectMapper.valueToTree(decision));
    }
    if (decided.size() != detected.size()) {
      throw new IllegalArgumentException(
          "Confirm, modify, match, or ignore every detected work type");
    }

    var confirmedAnalysis = (com.fasterxml.jackson.databind.node.ObjectNode)
        batch.getAnalysis().deepCopy();
    confirmedAnalysis.set("confirmedDecisions", decisionsJson);
    batch.markReady(confirmedAnalysis);
    return new DataImportConfirmResponse(
        batch.getId(), batch.getStatus().name(), created, mapped, ignored, confirmed);
  }

  @Transactional
  public DataImportAnalysisResponse setPeriod(UUID batchId, DataImportPeriodRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    DataImportBatch batch = batchRepository.findByIdAndUserId(batchId, userId)
        .orElseThrow(() -> new IllegalArgumentException("Import batch was not found"));
    if (batch.getStatus() == DataImportStatus.IMPORTED) {
      throw new IllegalArgumentException("An imported batch can no longer be changed");
    }
    var analysis = (com.fasterxml.jackson.databind.node.ObjectNode) batch.getAnalysis().deepCopy();
    if (request.sheets() != null && !request.sheets().isEmpty()) {
      Set<String> workbookSheets = new HashSet<>();
      batch.getWorkbookData().path("sheets").forEach(
          sheet -> workbookSheets.add(sheet.path("name").asText()));
      var periods = analysis.putArray("sheetPeriodContexts");
      Set<String> supplied = new HashSet<>();
      for (var period : request.sheets()) {
        validatePeriod(period.year(), period.month());
        if (!workbookSheets.contains(period.sheet()) || !supplied.add(period.sheet())) {
          throw new IllegalArgumentException("Every sheet period must reference one sheet once");
        }
        periods.addObject()
            .put("sheet", period.sheet())
            .put("year", period.year())
            .put("month", period.month())
            .put("source", "USER_CONFIRMED");
      }
      if (!supplied.equals(workbookSheets)) {
        throw new IllegalArgumentException("Confirm the period for every workbook sheet");
      }
      analysis.remove("periodContext");
    } else {
      validatePeriod(request.year(), request.month());
      analysis.putObject("periodContext")
          .put("year", request.year())
          .put("month", request.month())
          .put("source", "USER_CONFIRMED");
      analysis.remove("sheetPeriodContexts");
    }
    batch.updateAnalysis(analysis);
    return response(batch, false);
  }

  private void validatePeriod(Integer year, Integer month) {
    if (year == null || year < 2000 || year > 2100
        || month == null || month < 1 || month > 12) {
      throw new IllegalArgumentException("Choose a valid month and year");
    }
  }

  private com.alveryn.api.worktype.entity.WorkType resolveMappedWorkType(
      UUID userId, UUID employmentId, UUID workTypeId) {
    if (workTypeId == null) {
      throw new IllegalArgumentException("Choose the existing work type");
    }
    var workType = workTypeRepository.findByIdAndUserId(workTypeId, userId)
        .orElseThrow(() -> new IllegalArgumentException("Work type was not found"));
    if (workType.getEmployment() == null
        || !workType.getEmployment().getId().equals(employmentId)) {
      throw new IllegalArgumentException("Work type belongs to another employment");
    }
    return workType;
  }

  private com.alveryn.api.worktype.entity.WorkType createWorkType(
      DataImportBatch batch, DataImportCandidateDecision decision) {
    if (decision.name() == null || decision.name().isBlank()
        || decision.calculationMethod() == null) {
      throw new IllegalArgumentException(
          "Name and calculation method are required for a new work type");
    }
    CalculationMethod method = decision.calculationMethod();
    String unitLabel = method == CalculationMethod.UNIT_BASED
        || method == CalculationMethod.UNITS_PER_HOUR_BASED ? "unit" : null;
    String unitSymbol = unitLabel == null ? null : "u";
    var response = workTypeService.create(new CreateWorkTypeRequest(
        decision.name(),
        batch.getEmployment().getId(),
        null,
        method,
        decision.compensationMethod(),
        unitLabel,
        unitSymbol,
        method == CalculationMethod.UNITS_PER_HOUR_BASED ? decision.unitsPerHour() : null,
        method == CalculationMethod.UNIT_BASED ? decision.ratePerUnit() : null,
        method == CalculationMethod.UNIT_BASED
            ? (decision.currency() == null ? "EUR" : decision.currency()) : null,
        Boolean.TRUE.equals(decision.teamworkEnabled()),
        true,
        false,
        null,
        null,
        null,
        null));
    return workTypeRepository.findByIdAndUserId(response.id(), batch.getUser().getId())
        .orElseThrow(() -> new IllegalStateException("Created work type was not found"));
  }

  private Employment resolveEmployment(DataImportScope scope, UUID employmentId, UUID userId) {
    if (scope == DataImportScope.MULTIPLE) {
      if (employmentId != null) {
        throw new IllegalArgumentException(
            "employmentId must be omitted when the workbook contains multiple employments");
      }
      return null;
    }
    if (employmentId == null) {
      throw new IllegalArgumentException(
          "Choose the employment represented by this workbook");
    }
    return employmentRepository.findByIdAndUserId(employmentId, userId)
        .orElseThrow(() -> new IllegalArgumentException("Employment does not belong to this user"));
  }

  private void validate(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("Choose a spreadsheet, note, PDF or image");
    }
    if (file.getSize() > MAX_SIZE) throw new IllegalArgumentException("File exceeds the 10 MB limit");
    String filename = safeFilename(file.getOriginalFilename());
    String lower = filename.toLowerCase(Locale.ROOT);
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".txt")
        && !lower.endsWith(".pdf") && !lower.endsWith(".jpg")
        && !lower.endsWith(".jpeg") && !lower.endsWith(".png")
        && !lower.endsWith(".webp")) {
      throw new IllegalArgumentException(
          "Supported files are XLSX, TXT, PDF, JPG, PNG and WEBP");
    }
  }

  private boolean isTextFile(MultipartFile file) {
    return safeFilename(file.getOriginalFilename()).toLowerCase(Locale.ROOT).endsWith(".txt");
  }

  private boolean isVisualFile(MultipartFile file) {
    String lower = safeFilename(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
    return lower.endsWith(".pdf") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
        || lower.endsWith(".png") || lower.endsWith(".webp");
  }

  private String safeFilename(String filename) {
    if (filename == null || filename.isBlank()) return "import.xlsx";
    String safe = Paths.get(filename).getFileName().toString().replaceAll("[\\p{Cntrl}]", "");
    return safe.length() <= 255 ? safe : safe.substring(safe.length() - 255);
  }

  private DataImportAnalysisResponse response(DataImportBatch batch, boolean duplicate) {
    return new DataImportAnalysisResponse(
        batch.getId(), batch.getSourceFilename(), batch.getSourceSha256(), batch.getSourceSize(),
        batch.getStatus().name(), batch.getImportScope().name(),
        batch.getEmployment() == null ? null : batch.getEmployment().getId(),
        duplicate, objectMapper.convertValue(
            batch.getAnalysis(), new TypeReference<Map<String, Object>>() {}));
  }

  @Transactional(readOnly = true)
  public SourceDocument sourceDocument(UUID batchId) {
    var userId = authenticatedUserAccessor.requireUserId();
    DataImportBatch batch = batchRepository.findByIdAndUserId(batchId, userId)
        .orElseThrow(() -> new IllegalArgumentException("Import does not exist"));
    if (batch.getSourceContent() == null) {
      throw new IllegalArgumentException("The original file was not stored for this import");
    }
    return new SourceDocument(batch.getSourceFilename(),
        batch.getSourceContentType() == null ? "application/octet-stream" : batch.getSourceContentType(),
        batch.getSourceContent());
  }

  public record SourceDocument(String filename, String contentType, byte[] content) {}
}
