package com.alveryn.api.staffing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Explicit aggregate-native write contracts. Tenant, plan and audit fields are server-owned. */
public final class StaffingPlanMutationDtos {
  private StaffingPlanMutationDtos() {}

  public record RequirementInput(@NotNull LocalDate date, @NotNull UUID workTypeId,
      LocalTime startTime, LocalTime endTime, @Positive int requiredWorkers,
      @Positive BigDecimal requiredQuantity, @Size(max = 500) String notes) {}

  public record RequirementUpdateInput(LocalTime startTime, LocalTime endTime,
      @Positive int requiredWorkers, @Positive BigDecimal requiredQuantity,
      @Size(max = 500) String notes) {}

  public record DemandBatchAction(@NotNull BatchOperation operation, UUID requirementId,
      @Valid RequirementInput create, @Valid RequirementUpdateInput update) {}

  public record DemandBatchRequest(@NotEmpty @Size(max = 100)
      List<@Valid DemandBatchAction> actions) {}

  public record AssignmentInput(@NotNull UUID requirementId, @NotNull UUID membershipId,
      LocalTime startTime, LocalTime endTime) {}

  public record AssignmentUpdateInput(LocalTime startTime, LocalTime endTime) {}

  public record AssignmentBatchAction(@NotNull BatchOperation operation, UUID assignmentId,
      @Valid AssignmentInput create, @Valid AssignmentUpdateInput update) {}

  public record AssignmentBatchRequest(@NotEmpty @Size(max = 100)
      List<@Valid AssignmentBatchAction> actions) {}

  public record MutationResponse(UUID planId, long previousDraftRevision,
      long currentDraftRevision, boolean changed, Set<UUID> affectedResourceIds) {}

  public enum BatchOperation { CREATE, UPDATE, DELETE, CANCEL }
}
