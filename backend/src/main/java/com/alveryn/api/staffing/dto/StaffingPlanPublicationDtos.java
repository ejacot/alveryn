package com.alveryn.api.staffing.dto;

import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Explicit manager contract for one atomic weekly publication. */
public final class StaffingPlanPublicationDtos {
  private StaffingPlanPublicationDtos() {}

  public record PublishRequest(
      @Size(max = 200) List<@Size(max = 500) String> acknowledgementKeys,
      @Size(max = 1000) String publicationNote) {}

  public record CoverageResponse(int required, int rawAssigned, int effectiveAssigned,
      int covered, int missing, int overstaffed, BigDecimal percentage) {}

  public record PublishResponse(UUID planId, UUID versionId, int versionNumber,
      long sourceDraftRevision, long publishedRevision, OffsetDateTime publishedAt,
      String publicationKind, CoverageResponse canonicalCoverage, int warningCount,
      String checksum, boolean idempotentReplay) {}
}
