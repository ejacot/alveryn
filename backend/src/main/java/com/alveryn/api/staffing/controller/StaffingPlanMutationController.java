package com.alveryn.api.staffing.controller;

import static com.alveryn.api.staffing.dto.StaffingPlanMutationDtos.*;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.staffing.service.StaffingPlanDraftMutationService;
import com.alveryn.api.staffing.service.StaffingPlanMutationCoordinator;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/organizations/{organizationId}/staffing/plans/{planId}")
@RequiredArgsConstructor
public class StaffingPlanMutationController {
  private final StaffingPlanDraftMutationService service;

  @PostMapping("/demand/requirements")
  public ResponseEntity<ApiResponse<MutationResponse>> createRequirement(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody RequirementInput input) {
    return response(HttpStatus.CREATED, service.createRequirement(organizationId, planId,
        ifMatch, idempotencyKey, input));
  }

  @PutMapping("/demand/requirements/{requirementId}")
  public ResponseEntity<ApiResponse<MutationResponse>> updateRequirement(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @PathVariable UUID requirementId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @Valid @RequestBody RequirementUpdateInput input) {
    return response(HttpStatus.OK, service.updateRequirement(organizationId, planId,
        requirementId, ifMatch, input));
  }

  @DeleteMapping("/demand/requirements/{requirementId}")
  public ResponseEntity<ApiResponse<MutationResponse>> deleteRequirement(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @PathVariable UUID requirementId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
    return response(HttpStatus.OK, service.deleteRequirement(organizationId, planId,
        requirementId, ifMatch));
  }

  @PostMapping("/demand/batch")
  public ResponseEntity<ApiResponse<MutationResponse>> batchDemand(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody DemandBatchRequest request) {
    return response(HttpStatus.OK, service.batchDemand(organizationId, planId, ifMatch,
        idempotencyKey, request));
  }

  @PostMapping("/schedule/assignments")
  public ResponseEntity<ApiResponse<MutationResponse>> createAssignment(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody AssignmentInput input) {
    return response(HttpStatus.CREATED, service.createAssignment(organizationId, planId,
        ifMatch, idempotencyKey, input));
  }

  @PutMapping("/schedule/assignments/{assignmentId}")
  public ResponseEntity<ApiResponse<MutationResponse>> updateAssignment(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @PathVariable UUID assignmentId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @Valid @RequestBody AssignmentUpdateInput input) {
    return response(HttpStatus.OK, service.updateAssignment(organizationId, planId,
        assignmentId, ifMatch, input));
  }

  @DeleteMapping("/schedule/assignments/{assignmentId}")
  public ResponseEntity<ApiResponse<MutationResponse>> cancelAssignment(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @PathVariable UUID assignmentId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
    return response(HttpStatus.OK, service.cancelAssignment(organizationId, planId,
        assignmentId, ifMatch));
  }

  @PostMapping("/schedule/assignments/batch")
  public ResponseEntity<ApiResponse<MutationResponse>> batchAssignments(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody AssignmentBatchRequest request) {
    return response(HttpStatus.OK, service.batchAssignments(organizationId, planId, ifMatch,
        idempotencyKey, request));
  }

  private ResponseEntity<ApiResponse<MutationResponse>> response(HttpStatus status,
      MutationResponse value) {
    return ResponseEntity.status(status)
        .header(HttpHeaders.ETAG, StaffingPlanMutationCoordinator.etag(
            value.planId(), value.currentDraftRevision()))
        .body(ApiResponse.of(value));
  }
}
