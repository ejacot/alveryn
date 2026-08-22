package com.alveryn.api.staffing.controller;

import static com.alveryn.api.staffing.dto.StaffingPlanPublicationDtos.*;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.staffing.service.StaffingPlanPublicationApiService;
import com.alveryn.api.staffing.service.StaffingPlanQueryService;
import jakarta.validation.Valid;
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
@RequestMapping("/api/organizations/{organizationId}/staffing/plans/{planId}")
@RequiredArgsConstructor
public class StaffingPlanPublicationController {
  private final StaffingPlanPublicationApiService service;

  @PostMapping("/publish")
  public ResponseEntity<ApiResponse<PublishResponse>> publish(
      @PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody(required = false) PublishRequest request) {
    PublishResponse result = service.publish(organizationId, planId, ifMatch, idempotencyKey,
        request);
    HttpStatus status = result.idempotentReplay() ? HttpStatus.OK : HttpStatus.CREATED;
    var response = ResponseEntity.status(status)
        .location(URI.create("/api/organizations/" + organizationId + "/staffing/plans/"
            + planId + "/versions/" + result.versionNumber()))
        .eTag(StaffingPlanQueryService.immutableVersionEtag(result.versionId(), result.checksum()))
        .cacheControl(CacheControl.noCache().cachePrivate());
    if (result.idempotentReplay()) response.header("Idempotent-Replay", "true");
    return response.body(ApiResponse.of(result));
  }
}
