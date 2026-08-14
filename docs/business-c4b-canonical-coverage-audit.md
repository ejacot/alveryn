# C4b — canonical Business coverage and planning review

## Scope

`StaffingPlanCoverageService` is the single operational calculation for a weekly Business
`StaffingPlan`. It is read-only, tenant/unit scoped, and does not read Personal work records.
It supplies both the manager requirement read model and the C3b atomic publication transaction.

Historical V92 backfill SQL retains its original `LEGACY_V90` calculation because it reconstructs
past legacy publications during migration. It is not used to calculate a current draft. The
Personal `scheduled_shifts` system is a separate domain and is intentionally unchanged.

## Calculation sites audited

| Previous site | C4b result |
| --- | --- |
| `StaffingPlannerService.requirementResponse` counted assigned entity rows | Replaced by the requirement result from `StaffingPlanCoverageService`; DTO shape remains compatible. |
| C3b `StaffingPlanPublicationWriter.coverage/review` | Removed. Publish invokes the canonical service once under the plan lock and reuses that immutable result. |
| V92 legacy version backfill | Preserved as historical migration-only logic, labelled `LEGACY_V90`. |
| Personal `ScheduleService` / `scheduled_shifts` coverage | Out of scope and separate from Business. |

V94 preserves `coverage_assigned` for backward compatibility and adds exact nullable canonical
columns. Legacy backfill rows keep their historical value and leave the new columns `NULL`. New
atomic publications store canonical `effectiveAssigned` in the compatibility column and persist
`rawAssigned`, `effectiveAssigned`, `covered`, `missing`, and `overstaffed` separately. All six
header values are written from the same in-transaction `CoverageResult`.

## Canonical formulas

For every requirement:

```text
covered      = min(effectiveAssigned, required)
missing      = max(required - effectiveAssigned, 0)
overstaffed  = max(effectiveAssigned - required, 0)
```

Day and week values are sums of the per-requirement values. Surplus on one requirement therefore
cannot hide a shortage on another. Percentage is `sum(covered) / sum(required) * 100`, rounded to
two decimals with `HALF_UP`; when required is zero it is exactly `0.00`.

`assigned` contains non-cancelled (`ASSIGNED`) rows. `effectiveAssigned` contains only assignments
which remain after requirement, membership, interval, approved absence, overlap and duplicate
validation. `openPositions` equals canonical `missing` at requirement, day and plan level.

## Status and issue policy

The service emits stable resource-specific keys and localization keys; it does not build localized
messages or include email/Personal data.

### Blocking conflicts

- tenant mismatch;
- plan unit mismatch;
- requirement outside the seven-day plan week;
- missing/invalid interval (`end <= start` is invalid; overnight is not inferred);
- inactive work type;
- suspended or otherwise inactive membership;
- exact duplicate assignment;
- real interval overlap for the same employee and day, including another unit in the same Business;
- approved `VACATION` or `SICK` member-day status;
- empty plan.

Touching intervals are not overlaps. Every current assignment participating in an overlap set is
excluded from effective coverage, independent of insertion order. Same-plan issue keys use a
sorted assignment pair. Cross-unit conflicts expose only an opaque stable hash and an
`externalConflict` marker; they do not reveal the other assignment, requirement, unit, or employee
through the current plan's review payload. Breaks are not considered by the current schema. The
assignment-to-requirement FK and source join make a detached assignment/requirement relation
unrepresentable through supported writes; the issue code remains reserved for future additive
integrity checks. The current model has no approved `UNAVAILABLE` member-day type, so no such rule
is claimed.

### Non-blocking attention

- undercoverage (`WARNING`);
- overstaffing (`WARNING`);
- invited membership (`WARNING`, assigned for audit but never effective);
- interval override (`WARNING`);
- pending absence/free request (`PENDING_REQUEST`).

The severity policy is explicit and exhaustive:

| Severity | acknowledgement | blocks publish | warning count |
| --- | --- | --- | --- |
| `BLOCKING_CONFLICT` | no | yes | no |
| `WARNING` | yes | no | yes |
| `INFORMATION` | no | no | no |
| `PENDING_REQUEST` | yes | no | yes |
| `UNCONFIRMED_CHANGE` | yes | no | yes |

Blocking conflicts can never be acknowledged. No unusual-role or unconfirmed-change issue is
currently emitted because current data cannot prove either safely.

## Read and publication integration

The canonical calculation uses a bounded query set:

1. scoped plan;
2. plan requirements and assignments;
3. member-day entries (only when assigned members exist);
4. pending requests (only when assigned members exist);
5. comparable same-Business assignments for overlap detection (only when assigned members exist).

An integration regression test observes the JDBC boundary and proves that both a one-requirement
plan and a twelve-requirement/48-assignment plan execute exactly five canonical coverage reads.
The count is independent of employees, days and requirements. The existing manager DTO shape is
preserved, but its assignment details, assignment results and schedule receipts are loaded through
three batch reads for all visible requirements rather than repository calls per row. Each distinct
weekly plan is then calculated once, so increasing employees, days or requirements does not create
an N+1 query pattern in the managerial week read. Unit-scoped role assignments are also loaded once
into a reusable access predicate instead of reloading membership and permissions for every row.

Inside C3b, the plan row is locked before calculation. One `CoverageResult` supplies blockers,
warning acknowledgements, snapshot header counts, percentage and warning count. The source
fingerprint before/after snapshot creation remains the defence-in-depth guard against changes made
outside the coordinated mutation boundary.

The employee self-schedule contract introduced in C1 is unchanged and continues to expose only the
current member's published assignments and own day statuses.

## Known compatibility labels

`coverage_basis = LEGACY_V90` and the result DTO name `LegacyCoverage` remain for compatibility.
V94 makes the exact C4b semantics independently auditable without relabelling immutable historical
rows: legacy rows have nullable canonical fields, while every new atomic row has all five exact
canonical fields populated.
