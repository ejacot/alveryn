package com.alveryn.api.staffing.controller;

import static com.alveryn.api.staffing.dto.StaffingPlanBootstrapDtos.*;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.staffing.service.StaffingPlanBootstrapService;
import java.net.URI;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/organizations/{organizationId}/staffing/plans")
@RequiredArgsConstructor
public class StaffingPlanBootstrapController {
  private final StaffingPlanBootstrapService service;

  @PostMapping
  public ResponseEntity<ApiResponse<CreatePlanResponse>> create(
      @PathVariable UUID organizationId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @RequestBody(required = false) CreatePlanRequest request) {
    BootstrapResult result = service.create(organizationId, idempotencyKey, request);
    HttpStatus status = result.created() && !result.idempotentReplay()
        ? HttpStatus.CREATED : HttpStatus.OK;
    var response = ResponseEntity.status(status)
        .location(URI.create("/api/organizations/" + organizationId + "/staffing/plans/"
            + result.response().planId()))
        .header(HttpHeaders.ETAG, result.etag())
        .cacheControl(CacheControl.noStore().cachePrivate());
    if (result.idempotentReplay()) response.header("Idempotent-Replay", "true");
    return response.body(ApiResponse.of(result.response()));
  }
}
