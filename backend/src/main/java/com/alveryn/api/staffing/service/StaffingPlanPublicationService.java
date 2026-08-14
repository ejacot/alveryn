package com.alveryn.api.staffing.service;

import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.PreconditionFailedException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationPermission;
import com.alveryn.api.organization.service.OrganizationAccessService;
import com.alveryn.api.staffing.entity.StaffingChangeEvent;
import com.alveryn.api.staffing.entity.StaffingPlanVersion;
import com.alveryn.api.staffing.repository.StaffingChangeEventRepository;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StaffingPlanPublicationService {
  private final StaffingPlanRepository plans;
  private final StaffingPlanPublicationWriter writer;
  private final OrganizationAccessService access;
  private final StaffingChangeEventRepository audit;
  private final EntityManager entityManager;
  private final StaffingPlanPublicationFaultProbe faultProbe;

  /**
   * Publishes one complete weekly plan. A row lock plus two source fingerprints is the temporary
   * guard while legacy planner mutations do not yet increment draft_revision.
   *
   * <p><strong>Do not expose this service through a production endpoint or legacy flow</strong>
   * until every Demand/Schedule mutation increments {@code draft_revision} and participates in
   * plan concurrency control. The current guard is intentionally sufficient only for this
   * internal, non-routable C3b foundation.
   */
  @Transactional
  public PublicationResult publishPlan(PublishCommand command) {
    validate(command);
    String note = clean(command.publicationNote());
    List<String> acknowledgedKeys = command.acknowledgedIssueKeys().stream()
        .filter(Objects::nonNull).map(String::trim).filter(value -> !value.isEmpty())
        .distinct().sorted().toList();
    String requestFingerprint = requestFingerprint(command, acknowledgedKeys, note);

    var plan = plans.lockByScope(command.organizationId(), command.unitId(), command.planId())
        .orElseThrow(() -> new NotFoundException("Staffing plan", command.planId()));
    OrganizationMembership publisher = access.requireForUnit(command.organizationId(), plan.getUnit(),
        OrganizationPermission.PUBLISH_SCHEDULE);
    if (!publisher.getId().equals(command.publisherMembershipId())) {
      throw new AccessDeniedException("Publisher must match the authenticated membership");
    }
    if (publisher.getStatus() != MembershipStatus.ACTIVE) {
      throw new AccessDeniedException("Only an active membership can publish a schedule");
    }

    Optional<StaffingPlanPublicationWriter.Operation> existing = writer.findOperation(
        command.organizationId(), command.planId(), command.idempotencyKey().trim());
    if (existing.isPresent()) {
      var operation = existing.get();
      if (!operation.requestFingerprint().equals(requestFingerprint)) {
        throw new ConflictException("Idempotency key was already used for another request",
            "IDEMPOTENCY_KEY_REUSED");
      }
      if ("COMPLETED".equals(operation.status()) && operation.versionId() != null) {
        return result(command, plan.hasUnpublishedChanges(), acknowledgedKeys,
            writer.versionSummary(command.organizationId(), command.unitId(), command.planId(),
                operation.versionId()), true);
      }
      throw new ConflictException("Publication with this idempotency key is already processing",
          "PUBLICATION_IN_PROGRESS");
    }

    if (plan.getDraftRevision() != command.expectedDraftRevision()) {
      throw new PreconditionFailedException("Staffing plan draft revision is stale");
    }
    if (plan.getPublishedRevision() != null
        && plan.getPublishedRevision() == command.expectedDraftRevision()
        && plan.getLatestPublishedVersion() != null
        && plan.getLatestPublishedVersion().isSourceDraftComplete()) {
      throw new ConflictException("This staffing plan revision is already published",
          "REVISION_ALREADY_PUBLISHED");
    }

    OffsetDateTime now = OffsetDateTime.now();
    UUID operationId = UUID.randomUUID();
    writer.startOperation(operationId, command.organizationId(), command.unitId(), command.planId(),
        command.idempotencyKey().trim(), requestFingerprint, command.expectedDraftRevision(), now);

    String sourceBefore = writer.sourceFingerprint(command.organizationId(), command.unitId(),
        command.planId());
    List<StaffingPlanPublicationWriter.Issue> issues = writer.review(command.organizationId(),
        command.unitId(), command.planId());
    List<String> blockers = issues.stream()
        .filter(issue -> issue.severity() == StaffingPlanPublicationWriter.Severity.BLOCKING_CONFLICT)
        .map(StaffingPlanPublicationWriter.Issue::key).toList();
    if (!blockers.isEmpty()) {
      throw new ConflictException("Staffing plan has blocking conflicts",
          "PUBLICATION_BLOCKED", blockers);
    }
    Set<String> actualWarnings = new LinkedHashSet<>();
    issues.stream().filter(issue -> issue.severity() == StaffingPlanPublicationWriter.Severity.WARNING)
        .map(StaffingPlanPublicationWriter.Issue::key).forEach(actualWarnings::add);
    List<String> unknown = acknowledgedKeys.stream().filter(key -> !actualWarnings.contains(key)).toList();
    if (!unknown.isEmpty()) {
      throw new ValidationException("Acknowledged issue keys are not present in the current review");
    }
    List<String> missing = issues.stream().filter(StaffingPlanPublicationWriter.Issue::acknowledgementRequired)
        .map(StaffingPlanPublicationWriter.Issue::key).filter(key -> !acknowledgedKeys.contains(key)).toList();
    if (!missing.isEmpty()) {
      throw new ConflictException("Warnings must be acknowledged before publication",
          "WARNINGS_NOT_ACKNOWLEDGED", missing);
    }

    StaffingPlanPublicationWriter.Coverage coverage = writer.coverage(command.planId());
    int versionNumber = writer.nextVersionNumber(command.planId());
    UUID previousVersionId = plan.getLatestPublishedVersion() == null ? null
        : plan.getLatestPublishedVersion().getId();
    UUID versionId = UUID.randomUUID();
    String publisherName = displayName(publisher);
    writer.insertVersion(versionId, command.organizationId(), command.unitId(), command.planId(),
        versionNumber, command.expectedDraftRevision(), previousVersionId, publisher.getId(),
        publisherName, now, plan.getTimezone(), plan.getWeekStart(), coverage,
        actualWarnings.size(), note);
    faultProbe.check(StaffingPlanPublicationFaultProbe.Stage.AFTER_HEADER);
    writer.snapshotDaysAndRequirements(versionId, command.planId(), command.organizationId(), now);
    faultProbe.check(StaffingPlanPublicationFaultProbe.Stage.AFTER_REQUIREMENTS);
    writer.snapshotAssignments(versionId, command.planId(), command.organizationId(), now);
    faultProbe.check(StaffingPlanPublicationFaultProbe.Stage.AFTER_ASSIGNMENTS);
    writer.snapshotMemberDays(versionId, command.planId(), command.organizationId(), now);
    List<StaffingPlanPublicationWriter.Issue> acknowledgedIssues = issues.stream()
        .filter(issue -> acknowledgedKeys.contains(issue.key())).toList();
    writer.acknowledgements(versionId, acknowledgedIssues, publisher.getId(), publisherName, now);
    String checksum = writer.calculateAndStoreChecksum(versionId);
    String sourceAfter = writer.sourceFingerprint(command.organizationId(), command.unitId(),
        command.planId());
    if (!sourceBefore.equals(sourceAfter)) {
      throw new ConflictException("Staffing plan changed during publication",
          "PUBLICATION_SOURCE_CHANGED");
    }

    StaffingPlanVersion versionReference = entityManager.getReference(StaffingPlanVersion.class, versionId);
    plan.recordPublication(versionReference, command.expectedDraftRevision(), now);
    plans.saveAndFlush(plan);
    audit.save(new StaffingChangeEvent(plan.getOrganization(), publisher, "WEEKLY_PLAN_PUBLISHED",
        "STAFFING_PLAN", plan.getId(), plan.getWeekStart(),
        "Published weekly staffing plan v" + versionNumber));
    writer.completeOperation(operationId, versionId, sourceAfter, now);

    var summary = new StaffingPlanPublicationWriter.VersionSummary(versionId, versionNumber,
        command.expectedDraftRevision(), now, checksum, "ATOMIC_WEEKLY", coverage.required(),
        coverage.assigned(), percentage(coverage), actualWarnings.size());
    return result(command, false, acknowledgedKeys, summary, false);
  }

  private PublicationResult result(PublishCommand command, boolean hasUnpublishedChanges,
      List<String> acknowledged, StaffingPlanPublicationWriter.VersionSummary version,
      boolean replay) {
    return new PublicationResult(command.planId(), version.id(), version.versionNumber(),
        version.revision(), version.publishedAt(), version.checksum(), version.publicationKind(),
        hasUnpublishedChanges, new LegacyCoverage(version.required(), version.assigned(),
            version.percentage(), "LEGACY_V90"), List.copyOf(acknowledged), replay);
  }

  private static BigDecimal percentage(StaffingPlanPublicationWriter.Coverage coverage) {
    return coverage.required() == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(coverage.assigned())
        .multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(coverage.required()), 2,
            java.math.RoundingMode.HALF_UP);
  }

  private static void validate(PublishCommand command) {
    Objects.requireNonNull(command, "command is required");
    Objects.requireNonNull(command.organizationId(), "organizationId is required");
    Objects.requireNonNull(command.unitId(), "unitId is required");
    Objects.requireNonNull(command.planId(), "planId is required");
    Objects.requireNonNull(command.publisherMembershipId(), "publisherMembershipId is required");
    Objects.requireNonNull(command.acknowledgedIssueKeys(), "acknowledgedIssueKeys is required");
    if (command.expectedDraftRevision() < 0) throw new IllegalArgumentException("revision is invalid");
    if (command.idempotencyKey() == null || command.idempotencyKey().isBlank()
        || command.idempotencyKey().trim().length() > 200) {
      throw new IllegalArgumentException("idempotencyKey is required and must not exceed 200 characters");
    }
    if (command.publicationNote() != null && command.publicationNote().trim().length() > 1000) {
      throw new IllegalArgumentException("publicationNote must not exceed 1000 characters");
    }
  }

  private static String displayName(OrganizationMembership member) {
    String value = String.join(" ", Objects.toString(member.getFirstName(), ""),
        Objects.toString(member.getLastName(), "")).trim();
    return value.isEmpty() ? "Member " + member.getId().toString().substring(0, 8) : value;
  }

  private static String requestFingerprint(PublishCommand command, List<String> keys, String note) {
    String canonical = String.join("\u001f", command.organizationId().toString(),
        command.unitId().toString(), command.planId().toString(),
        Long.toString(command.expectedDraftRevision()), command.publisherMembershipId().toString(),
        String.join("\u001e", keys), Objects.toString(note, "<NULL>"));
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
          .digest(canonical.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private static String clean(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  public record PublishCommand(UUID organizationId, UUID unitId, UUID planId,
      long expectedDraftRevision, UUID publisherMembershipId, Set<String> acknowledgedIssueKeys,
      String publicationNote, String idempotencyKey) {}

  public record PublicationResult(UUID planId, UUID versionId, int versionNumber,
      long publishedRevision, OffsetDateTime publishedAt, String checksum,
      String publicationKind, boolean hasUnpublishedChanges, LegacyCoverage legacyCoverage,
      List<String> warningsAcknowledged, boolean idempotentReplay) {}

  public record LegacyCoverage(int required, int assigned, BigDecimal percentage, String basis) {}
}
