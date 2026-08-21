package com.alveryn.api.staffing.service;

import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.PreconditionFailedException;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.staffing.entity.StaffingPlan;
import com.alveryn.api.staffing.entity.StaffingPlanDay;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.repository.StaffingPlanDayRepository;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single mutation boundary for the weekly staffing aggregate.
 *
 * <p>All locks are acquired in UUID order before child state is changed. Legacy callers may omit
 * an expected revision, but still serialize through the plan lock and increment exactly once.
 */
@Service
@RequiredArgsConstructor
public class StaffingPlanMutationCoordinator {
  private final StaffingPlanFactory planFactory;
  private final StaffingPlanRepository plans;
  private final StaffingPlanDayRepository days;
  private final StaffingPlanMutationFaultProbe faultProbe;

  @Transactional
  public <T> MutationResult<T> mutateDates(UUID organizationId, UUID unitId,
      Collection<LocalDate> dates, OrganizationMembership actor, Long expectedRevision,
      Function<Map<LocalDate, StaffingPlanDay>, Change<T>> operation) {
    if (dates == null || dates.isEmpty()) throw new IllegalArgumentException("dates are required");
    Map<LocalDate, StaffingPlan> byWeek = new LinkedHashMap<>();
    for (LocalDate date : new TreeSet<>(dates)) {
      LocalDate weekStart = weekStart(date);
      byWeek.computeIfAbsent(weekStart, ignored -> planFactory.getOrCreate(
          organizationId, unitId, weekStart, actor.getId()));
    }
    List<StaffingPlan> locked = lockAll(organizationId, byWeek.values().stream()
        .map(plan -> new Scope(plan.getId(), unitId)).toList());
    requireExpectedRevision(locked, expectedRevision);
    Map<LocalDate, StaffingPlan> lockedByWeek = new HashMap<>();
    locked.forEach(plan -> lockedByWeek.put(plan.getWeekStart(), plan));
    Map<LocalDate, StaffingPlanDay> planDays = new LinkedHashMap<>();
    for (LocalDate date : new TreeSet<>(dates)) {
      StaffingPlan plan = lockedByWeek.get(weekStart(date));
      StaffingPlanDay day = days.findByPlanIdAndOrganizationIdAndDate(
          plan.getId(), organizationId, date).orElseGet(() -> days.save(
              new StaffingPlanDay(plan, date, null, null, StaffingPlanDaySource.MANUAL)));
      planDays.put(date, day);
    }
    Change<T> change = Objects.requireNonNull(operation.apply(Map.copyOf(planDays)));
    faultProbe.afterChildMutation();
    return finish(locked, actor, change);
  }

  @Transactional
  public <T> MutationResult<T> mutateScopes(UUID organizationId, Collection<Scope> requested,
      OrganizationMembership actor, Long expectedRevision, Supplier<Change<T>> operation) {
    List<StaffingPlan> locked = lockAll(organizationId, requested);
    requireExpectedRevision(locked, expectedRevision);
    Change<T> change = Objects.requireNonNull(operation.get());
    faultProbe.afterChildMutation();
    return finish(locked, actor, change);
  }

  /** Aggregate-native single-plan mutation. The callback runs after the scoped row lock. */
  @Transactional
  public <T> MutationResult<T> mutatePlan(UUID organizationId, Scope requested,
      OrganizationMembership actor, Function<StaffingPlan, Change<T>> operation) {
    StaffingPlan locked = lockAll(organizationId, List.of(requested)).getFirst();
    Change<T> change = Objects.requireNonNull(operation.apply(locked));
    faultProbe.afterChildMutation();
    return finish(List.of(locked), actor, change);
  }

  public Scope requirementScope(UUID organizationId, UUID requirementId,
      com.alveryn.api.staffing.repository.StaffingRequirementRepository requirements) {
    return requirements.findPlanScope(organizationId, requirementId)
        .map(value -> new Scope(value.getPlanId(), value.getUnitId()))
        .orElseThrow(() -> new NotFoundException("Staffing requirement", requirementId));
  }

  public List<Scope> memberDateScopes(UUID organizationId, UUID membershipId,
      LocalDate from, LocalDate to) {
    if (from == null || to == null || to.isBefore(from)) {
      throw new IllegalArgumentException("member date scope is invalid");
    }
    Set<LocalDate> weekStarts = new LinkedHashSet<>();
    LocalDate cursor = weekStart(from);
    LocalDate last = weekStart(to);
    while (!cursor.isAfter(last)) {
      weekStarts.add(cursor);
      cursor = cursor.plusWeeks(1);
    }
    return plans.findScopesForMemberWeeks(organizationId, membershipId, weekStarts).stream()
        .map(value -> new Scope(value.getPlanId(), value.getUnitId())).toList();
  }

  public List<Scope> memberScopes(UUID organizationId, UUID membershipId) {
    return plans.findScopesForMember(organizationId, membershipId).stream()
        .map(value -> new Scope(value.getPlanId(), value.getUnitId())).toList();
  }

  public List<Scope> workTypeScopes(UUID organizationId, UUID workTypeId) {
    return plans.findScopesUsingWorkType(organizationId, workTypeId).stream()
        .map(value -> new Scope(value.getPlanId(), value.getUnitId())).toList();
  }

  private List<StaffingPlan> lockAll(UUID organizationId, Collection<Scope> requested) {
    return requested.stream().filter(Objects::nonNull)
        .collect(java.util.stream.Collectors.toMap(Scope::planId, value -> value,
            (left, right) -> {
              if (!left.unitId().equals(right.unitId())) {
                throw new IllegalArgumentException("plan scope has conflicting units");
              }
              return left;
            }))
        .values().stream().sorted(Comparator.comparing(value -> value.planId().toString()))
        .map(scope -> plans.lockByScope(organizationId, scope.unitId(), scope.planId())
            .orElseThrow(() -> new NotFoundException("Staffing plan", scope.planId())))
        .toList();
  }

  private static void requireExpectedRevision(List<StaffingPlan> locked, Long expected) {
    if (expected == null) return;
    if (locked.size() != 1) {
      throw new IllegalArgumentException("one expected revision can guard exactly one plan");
    }
    if (locked.getFirst().getDraftRevision() != expected) {
      throw new PreconditionFailedException("Staffing plan draft revision is stale");
    }
  }

  private static <T> MutationResult<T> finish(List<StaffingPlan> locked,
      OrganizationMembership actor, Change<T> change) {
    Map<UUID, Long> previous = new LinkedHashMap<>();
    Map<UUID, Long> current = new LinkedHashMap<>();
    for (StaffingPlan plan : locked) {
      previous.put(plan.getId(), plan.getDraftRevision());
      if (change.changed() && (change.changedPlanIds().isEmpty()
          || change.changedPlanIds().contains(plan.getId()))) {
        plan.markDraftChanged(actor);
      }
      current.put(plan.getId(), plan.getDraftRevision());
    }
    return new MutationResult<>(change.value(), change.changed(), Map.copyOf(previous),
        Map.copyOf(current), Set.copyOf(change.affectedResourceIds()));
  }

  private static LocalDate weekStart(LocalDate date) {
    Objects.requireNonNull(date, "date is required");
    return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  }

  public static String etag(UUID planId, long revision) {
    return "\"plan-" + planId + "-r" + revision + "\"";
  }

  public record Scope(UUID planId, UUID unitId) {
    public Scope { Objects.requireNonNull(planId); Objects.requireNonNull(unitId); }
  }

  public record Change<T>(T value, boolean changed, Set<UUID> affectedResourceIds,
      Set<UUID> changedPlanIds) {
    public Change {
      affectedResourceIds = affectedResourceIds == null ? Set.of() : Set.copyOf(affectedResourceIds);
      changedPlanIds = changedPlanIds == null ? Set.of() : Set.copyOf(changedPlanIds);
    }
    public Change(T value, boolean changed, Set<UUID> affectedResourceIds) {
      this(value, changed, affectedResourceIds, Set.of());
    }
    public static <T> Change<T> changed(T value, UUID... ids) {
      return new Change<>(value, true, new LinkedHashSet<>(Arrays.asList(ids)), Set.of());
    }
    public static <T> Change<T> changedInPlans(T value, Collection<UUID> resourceIds,
        Collection<UUID> planIds) {
      return new Change<>(value, true, new LinkedHashSet<>(resourceIds),
          new LinkedHashSet<>(planIds));
    }
    public static <T> Change<T> unchanged(T value) {
      return new Change<>(value, false, Set.of(), Set.of());
    }
  }

  public record MutationResult<T>(T value, boolean changed, Map<UUID, Long> previousRevisions,
      Map<UUID, Long> currentRevisions, Set<UUID> affectedResourceIds) {}
}
