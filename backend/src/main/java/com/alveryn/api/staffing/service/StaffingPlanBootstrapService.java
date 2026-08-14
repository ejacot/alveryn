package com.alveryn.api.staffing.service;

import static com.alveryn.api.staffing.dto.StaffingPlanBootstrapDtos.*;

import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.OrganizationPermission;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.entity.OrganizationUnit;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.organization.service.OrganizationAccessService;
import com.alveryn.api.staffing.dto.StaffingPlanQueryDtos.PlanCapabilities;
import com.alveryn.api.staffing.entity.StaffingChangeEvent;
import com.alveryn.api.staffing.exception.StaffingPlanMutationApiException;
import com.alveryn.api.staffing.repository.StaffingChangeEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates or locates an empty weekly aggregate without manufacturing child state. */
@Service
@RequiredArgsConstructor
public class StaffingPlanBootstrapService {
  private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[!-~]{1,200}$");
  private static final String FAMILY = "PLAN_CREATE";

  private final OrganizationAccessService access;
  private final OrganizationRepository organizations;
  private final OrganizationUnitRepository units;
  private final StaffingPlanFactory factory;
  private final StaffingChangeEventRepository audit;
  private final StaffingPlanBootstrapFaultProbe faultProbe;
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  @Transactional
  public BootstrapResult create(UUID organizationId, String idempotencyKey,
      CreatePlanRequest request) {
    CreatePlanRequest normalized = normalize(request);
    requireIdempotencyKey(idempotencyKey);
    Authorized authorized = authorize(organizationId, normalized.unitId());
    String key = idempotencyKey.trim();
    String fingerprint = fingerprint(authorized.actor().getId(), organizationId,
        normalized.unitId(), normalized.weekStart());

    // Organization scope is the mutex for the organization-wide PLAN_CREATE key. The factory then
    // locks the stable unit row for the natural plan key (organization, unit, Monday).
    var organization = organizations.lockById(organizationId)
        .filter(value -> value.getOrganizationType() == OrganizationType.BUSINESS)
        .orElseThrow(() -> notFound("Business organization not found"));
    ZoneId.of(organization.getTimezone());

    StoredOperation stored = stored(organizationId, key);
    if (stored != null) {
      if (!stored.fingerprint().equals(fingerprint)) {
        throw error(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
            "Idempotency key was already used for a different request");
      }
      CreatePlanResponse replay = readResponse(stored.payload());
      return new BootstrapResult(withReplay(replay, capabilities(authorized)),
          StaffingPlanMutationCoordinator.etag(replay.planId(), replay.draftRevision()),
          false, true);
    }

    var creation = factory.getOrCreateResult(organizationId, normalized.unitId(),
        normalized.weekStart(), authorized.actor().getId());
    var plan = creation.plan();
    var capabilities = capabilities(authorized);
    var response = new CreatePlanResponse(plan.getId(), organizationId, normalized.unitId(),
        plan.getWeekStart(), plan.getTimezone(), plan.getStatus().name(), plan.getDraftRevision(),
        creation.created(), false, capabilities);

    UUID operationId = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_plan_draft_mutation_operations(
          id,organization_id,unit_id,plan_id,actor_membership_id,operation_family,
          idempotency_key,request_fingerprint,base_draft_revision,operation_status)
        values(?,?,?,?,?,? ,?,?,?,'PROCESSING')
        """, operationId, organizationId, normalized.unitId(), plan.getId(),
        authorized.actor().getId(), FAMILY, key, fingerprint, plan.getDraftRevision());
    faultProbe.afterPlanCreated();
    if (creation.created()) {
      audit.save(new StaffingChangeEvent(organization, authorized.actor(), "WEEKLY_PLAN_CREATED",
          "PLAN", plan.getId(), plan.getWeekStart(), "Weekly staffing plan created"));
    }
    jdbc.update("""
        update staffing_plan_draft_mutation_operations
        set operation_status='COMPLETED',resulting_draft_revision=?,response_payload=?,
            completed_at=current_timestamp
        where id=?
        """, plan.getDraftRevision(), writeResponse(response), operationId);
    return new BootstrapResult(response,
        StaffingPlanMutationCoordinator.etag(plan.getId(), plan.getDraftRevision()),
        creation.created(), false);
  }

  private Authorized authorize(UUID organizationId, UUID unitId) {
    try {
      Set<OrganizationPermission> permissions = access.permissions(organizationId);
      OrganizationUnit unit = units.findByIdAndOrganizationId(unitId, organizationId)
          .filter(OrganizationUnit::isActive)
          .orElseThrow(() -> notFound("Organization unit not found"));
      if (!permissions.contains(OrganizationPermission.MANAGE_SCHEDULE)) {
        throw error(HttpStatus.FORBIDDEN, "FORBIDDEN",
            "Required organization permission is missing");
      }
      if (!access.unitAccessFilter(organizationId, OrganizationPermission.MANAGE_SCHEDULE)
          .test(unit)) throw notFound("Organization unit not found");
      var actor = access.requireForUnit(organizationId, unit,
          OrganizationPermission.MANAGE_SCHEDULE);
      return new Authorized(unit, actor, permissions);
    } catch (NotFoundException exception) {
      throw notFound("Organization unit not found");
    } catch (AccessDeniedException exception) {
      throw error(HttpStatus.FORBIDDEN, "FORBIDDEN",
          "Required organization permission is missing");
    }
  }

  private CreatePlanRequest normalize(CreatePlanRequest request) {
    if (request == null || request.unitId() == null || request.weekStart() == null) {
      throw validation("unitId and weekStart are required");
    }
    if (request.weekStart().getDayOfWeek() != DayOfWeek.MONDAY) {
      throw validation("weekStart must be Monday");
    }
    return request;
  }

  private void requireIdempotencyKey(String value) {
    if (value == null || !IDEMPOTENCY_KEY.matcher(value.trim()).matches()) {
      throw validation("Idempotency-Key must contain 1 to 200 visible ASCII characters");
    }
  }

  private StoredOperation stored(UUID organizationId, String key) {
    List<StoredOperation> values = jdbc.query("""
        select request_fingerprint,response_payload
        from staffing_plan_draft_mutation_operations
        where organization_id=? and operation_family=? and idempotency_key=?
          and operation_status='COMPLETED'
        """, (rs, row) -> new StoredOperation(rs.getString(1), rs.getString(2)),
        organizationId, FAMILY, key);
    return values.stream().findFirst().orElse(null);
  }

  private String fingerprint(UUID actor, UUID organizationId, UUID unitId,
      java.time.LocalDate weekStart) {
    try {
      var canonical = new LinkedHashMap<String, String>();
      canonical.put("actor", actor.toString());
      canonical.put("family", FAMILY);
      canonical.put("organizationId", organizationId.toString());
      canonical.put("unitId", unitId.toString());
      canonical.put("weekStart", weekStart.toString());
      return sha256(objectMapper.writeValueAsBytes(canonical));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not fingerprint plan bootstrap", exception);
    }
  }

  private String writeResponse(CreatePlanResponse response) {
    try { return objectMapper.writeValueAsString(response); }
    catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not store plan bootstrap response", exception);
    }
  }

  private CreatePlanResponse readResponse(String payload) {
    try { return objectMapper.readValue(payload, CreatePlanResponse.class); }
    catch (JsonProcessingException exception) {
      throw new IllegalStateException("Stored plan bootstrap response is invalid", exception);
    }
  }

  private PlanCapabilities capabilities(Authorized authorized) {
    return new PlanCapabilities(true, true,
        authorized.permissions().contains(OrganizationPermission.PUBLISH_SCHEDULE));
  }

  private CreatePlanResponse withReplay(CreatePlanResponse value, PlanCapabilities capabilities) {
    return new CreatePlanResponse(value.planId(), value.organizationId(), value.unitId(),
        value.weekStart(), value.timezone(), value.status(), value.draftRevision(),
        value.created(), true, capabilities);
  }

  private String sha256(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private StaffingPlanMutationApiException validation(String message) {
    return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
  }

  private StaffingPlanMutationApiException notFound(String message) {
    return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", message);
  }

  private StaffingPlanMutationApiException error(HttpStatus status, String code, String message) {
    return new StaffingPlanMutationApiException(status, code, message);
  }

  private record StoredOperation(String fingerprint, String payload) {}
  private record Authorized(OrganizationUnit unit,
      com.alveryn.api.organization.entity.OrganizationMembership actor,
      Set<OrganizationPermission> permissions) {}
}
