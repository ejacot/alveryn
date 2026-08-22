package com.alveryn.api.staffing.service;

import static com.alveryn.api.staffing.dto.StaffingPlanPublicationDtos.*;

import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.PreconditionFailedException;
import com.alveryn.api.organization.entity.OrganizationPermission;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.organization.service.OrganizationAccessService;
import com.alveryn.api.staffing.exception.StaffingPlanMutationApiException;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/** HTTP-facing adapter. Authorization precedes all revision disclosure. */
@Service
@RequiredArgsConstructor
public class StaffingPlanPublicationApiService {
  private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("[\\x21-\\x7e]{1,200}");

  private final StaffingPlanRepository plans;
  private final OrganizationUnitRepository units;
  private final OrganizationAccessService access;
  private final StaffingPlanPublicationService publication;
  private final StaffingPlanIfMatchParser ifMatchParser;

  public PublishResponse publish(UUID organizationId, UUID planId, String ifMatch,
      String idempotencyKey, PublishRequest request) {
    var plan = plans.findByIdAndOrganizationId(planId, organizationId)
        .orElseThrow(() -> new NotFoundException("Staffing plan", planId));
    var unit = units.findByIdAndOrganizationId(plan.getUnit().getId(), organizationId)
        .orElseThrow(() -> new NotFoundException("Staffing plan", planId));

    Set<OrganizationPermission> permissions = access.permissions(organizationId);
    if (!permissions.contains(OrganizationPermission.PUBLISH_SCHEDULE)) {
      throw new AccessDeniedException("Required organization permission is missing");
    }
    if (!access.unitAccessFilter(organizationId, OrganizationPermission.PUBLISH_SCHEDULE)
        .test(unit)) {
      throw new NotFoundException("Staffing plan", planId);
    }
    var publisher = access.requireForUnit(organizationId, unit,
        OrganizationPermission.PUBLISH_SCHEDULE);

    Set<Long> expected = ifMatchParser.parse(ifMatch, planId);
    long expectedRevision = expected.contains(plan.getDraftRevision()) ? plan.getDraftRevision()
        : expected.stream().sorted().findFirst().orElseThrow();
    requireIdempotencyKey(idempotencyKey);
    PublishRequest safeRequest = request == null ? new PublishRequest(List.of(), null) : request;
    Set<String> acknowledgements = safeRequest.acknowledgementKeys() == null ? Set.of()
        : new LinkedHashSet<>(safeRequest.acknowledgementKeys());

    StaffingPlanPublicationService.PublicationResult result;
    try {
      result = publication.publishPlan(new StaffingPlanPublicationService.PublishCommand(
          organizationId, unit.getId(), planId, expectedRevision, publisher.getId(),
          acknowledgements, safeRequest.publicationNote(), idempotencyKey.trim()));
    } catch (PreconditionFailedException exception) {
      long currentRevision = plans.findByIdAndOrganizationId(planId, organizationId)
          .map(value -> value.getDraftRevision()).orElse(plan.getDraftRevision());
      throw new StaffingPlanMutationApiException(HttpStatus.PRECONDITION_FAILED,
          "STALE_PLAN_REVISION", "Staffing plan draft revision is stale",
          StaffingPlanMutationCoordinator.etag(planId, currentRevision));
    }
    var coverage = result.canonicalCoverage();
    return new PublishResponse(result.planId(), result.versionId(), result.versionNumber(),
        result.publishedRevision(), result.publishedRevision(), result.publishedAt(),
        result.publicationKind(), new CoverageResponse(coverage.required(), coverage.assigned(),
        coverage.effectiveAssigned(), coverage.covered(), coverage.missing(),
        coverage.overstaffed(), coverage.percentage()), result.warningCount(), result.checksum(),
        result.idempotentReplay());
  }

  private void requireIdempotencyKey(String value) {
    if (value == null || !IDEMPOTENCY_KEY.matcher(value.trim()).matches()) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY",
          "Idempotency-Key must contain 1 to 200 visible ASCII characters");
    }
  }

  private StaffingPlanMutationApiException error(HttpStatus status, String code, String message) {
    return new StaffingPlanMutationApiException(status, code, message);
  }
}
