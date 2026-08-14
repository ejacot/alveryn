package com.alveryn.api.staffing.service;

import com.alveryn.api.staffing.exception.StaffingPlanMutationApiException;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Parses the shared strong plan-revision validator contract used by draft writes and publish. */
@Component
public class StaffingPlanIfMatchParser {
  private static final Pattern PLAN_ETAG = Pattern.compile(
      "\\\"plan-([0-9a-fA-F-]{36})-r([0-9]+)\\\"");

  public Set<Long> parse(String value, UUID planId) {
    if (value == null || value.isBlank()) {
      throw error(HttpStatus.PRECONDITION_REQUIRED, "PRECONDITION_REQUIRED",
          "If-Match is required");
    }
    if (value.trim().equals("*") || value.contains("W/")) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH",
          "If-Match requires one or more strong plan revision ETags");
    }
    Set<Long> revisions = new LinkedHashSet<>();
    for (String token : value.split(",")) {
      Matcher matcher = PLAN_ETAG.matcher(token.trim());
      if (!matcher.matches()) {
        throw error(HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "If-Match is malformed");
      }
      try {
        if (UUID.fromString(matcher.group(1)).equals(planId)) {
          revisions.add(Long.parseLong(matcher.group(2)));
        }
      } catch (IllegalArgumentException exception) {
        throw error(HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "If-Match is malformed");
      }
    }
    if (revisions.isEmpty()) {
      throw error(HttpStatus.PRECONDITION_FAILED, "STALE_PLAN_REVISION",
          "If-Match belongs to another staffing plan");
    }
    return Set.copyOf(revisions);
  }

  private StaffingPlanMutationApiException error(HttpStatus status, String code, String message) {
    return new StaffingPlanMutationApiException(status, code, message);
  }
}
