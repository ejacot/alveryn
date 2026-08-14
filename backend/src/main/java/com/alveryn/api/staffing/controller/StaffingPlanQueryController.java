package com.alveryn.api.staffing.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.staffing.dto.StaffingPlanQueryDtos.QueryResult;
import com.alveryn.api.staffing.service.StaffingPlanQueryService;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Aggregate-native, read-only manager API. */
@RestController
@RequestMapping("/api/organizations/{organizationId}/staffing/plans")
@RequiredArgsConstructor
public class StaffingPlanQueryController {
  private final StaffingPlanQueryService service;

  @GetMapping
  public ResponseEntity<?> find(@PathVariable UUID organizationId, @RequestParam UUID unitId,
      @RequestParam LocalDate weekStart,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.find(organizationId, unitId, weekStart, ifNoneMatch));
  }

  @GetMapping("/{planId}")
  public ResponseEntity<?> header(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.header(organizationId, planId, ifNoneMatch));
  }

  @GetMapping("/{planId}/demand")
  public ResponseEntity<?> demand(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.demand(organizationId, planId, ifNoneMatch));
  }

  @GetMapping("/{planId}/schedule")
  public ResponseEntity<?> schedule(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.schedule(organizationId, planId, ifNoneMatch));
  }

  @GetMapping("/{planId}/coverage")
  public ResponseEntity<?> coverage(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.coverage(organizationId, planId, ifNoneMatch));
  }

  @GetMapping("/{planId}/review")
  public ResponseEntity<?> review(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.review(organizationId, planId, ifNoneMatch));
  }

  @GetMapping("/{planId}/versions")
  public ResponseEntity<?> versions(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer beforeVersion,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.versions(organizationId, planId, limit, beforeVersion, ifNoneMatch));
  }

  @GetMapping("/{planId}/versions/{versionNumber}")
  public ResponseEntity<?> version(@PathVariable UUID organizationId, @PathVariable UUID planId,
      @PathVariable int versionNumber,
      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    return response(service.version(organizationId, planId, versionNumber, ifNoneMatch));
  }

  private ResponseEntity<?> response(QueryResult<?> result) {
    ResponseEntity.BodyBuilder builder = ResponseEntity.status(
        result.notModified() ? HttpStatus.NOT_MODIFIED : HttpStatus.OK);
    if (result.etag() != null) builder.eTag(stripQuotes(result.etag()));
    builder.cacheControl(result.immutable()
        ? CacheControl.noCache().cachePrivate()
        : CacheControl.noStore().cachePrivate());
    if (result.notModified()) return builder.build();
    return builder.body(ApiResponse.of(result.body()));
  }

  private String stripQuotes(String value) {
    return value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")
        ? value.substring(1, value.length() - 1) : value;
  }
}
