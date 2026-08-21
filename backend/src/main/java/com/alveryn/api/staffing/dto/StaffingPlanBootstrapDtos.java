package com.alveryn.api.staffing.dto;

import com.alveryn.api.staffing.dto.StaffingPlanQueryDtos.PlanCapabilities;
import java.time.LocalDate;
import java.util.UUID;

public final class StaffingPlanBootstrapDtos {
  private StaffingPlanBootstrapDtos() {}

  public record CreatePlanRequest(UUID unitId, LocalDate weekStart) {}

  public record CreatePlanResponse(UUID planId, UUID organizationId, UUID unitId,
      LocalDate weekStart, String timezone, String status, long draftRevision,
      boolean created, boolean idempotentReplay, PlanCapabilities capabilities) {}

  public record BootstrapResult(CreatePlanResponse response, String etag, boolean created,
      boolean idempotentReplay) {}
}
