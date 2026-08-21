# C5a — Aggregate-native manager query audit

## Scope

C5a adds read-only manager contracts for the weekly Business aggregate. It does not cut over the
existing planner UI, mutate a plan, publish a version, or change the employee self schedule.

## Existing implementation audit

| Area | Decision in C5a |
| --- | --- |
| `StaffingPlannerController` and `StaffingPlannerService` | Kept unchanged as legacy per-requirement reads and mutations. |
| `StaffingDtos.RequirementResponse` | Kept for existing consumers; not reused by aggregate reads because it mixes mutation-era and manager presentation concerns. |
| `PersonalBusinessScheduleController` and C1 self DTOs | Kept unchanged and never reused. Manager DTOs cannot enter the self response. |
| `StaffingPlan`, `StaffingPlanDay` | Official draft aggregate and source for plan headers and persisted days. |
| `StaffingPlanCoverageService` | Reused once per Demand/Schedule/Coverage/Review request as the sole source of coverage and issue semantics. |
| `StaffingPlanVersion` and snapshot tables | Official immutable source for version detail. Mutable work types, memberships, assignments and requirements are not joined for version contents. |
| `OrganizationAccessService` | Reused for ACTIVE membership, permission and hierarchical unit scope. |
| Current frontend `BusinessPlanner` | Remains on legacy endpoints. C5a creates the future cutover contract only. |
| B.1 prototype | Used only to check the information needed by Demand/Schedule/Review. It is not imported or modified. |

## New read routes

Base: `/api/organizations/{organizationId}/staffing/plans`

- `GET ?unitId=&weekStart=` — scoped lookup; never creates a plan.
- `GET /{planId}` — aggregate header and capabilities.
- `GET /{planId}/demand` — seven-day demand read model, including synthetic read-only empty days.
- `GET /{planId}/schedule` — requirements, assignments, relevant members and safe day states.
- `GET /{planId}/coverage` — explicit mapping of canonical coverage.
- `GET /{planId}/review` — issues grouped by stable severity and message keys.
- `GET /{planId}/versions?limit=&beforeVersion=` — immutable version metadata, ordered by
  descending version number with deterministic cursor pagination (`limit` defaults to 20 and is
  capped at 100).
- `GET /{planId}/versions/{versionNumber}` — snapshot-only version detail.

All new routes require `VIEW_SCHEDULE`. Another organization or inaccessible sibling unit is
opaque `404`; missing permission inside an accessible organization is `403`. Authorization runs
before conditional-cache evaluation.

## Contract and privacy rules

- Draft ETag: `"plan-{planId}-r{draftRevision}"` on header, Demand, Schedule, Coverage and Review.
- Immutable version ETag: `"plan-version-{versionId}-{fullSha256Checksum}"`; the checksum is never
  truncated.
- A version-list ETag is a full SHA-256 digest of the requested page identity, cursor, stable order,
  checksums and latest markers. Different pages therefore cannot share validators accidentally.
- Draft responses are `private, no-store`; immutable detail is private and revalidatable.
- `If-None-Match` supports exact, weak, comma-separated and wildcard validators. Invalid validators
  are ignored safely. A match returns `304` with no body and the same `ETag`/`Cache-Control`, after
  authorization and plan/version validation but before coverage or snapshot collection mapping.
- Dates use ISO local dates, times use ISO local times and decimals remain JSON decimal values.
- Schedule member data contains display name, membership status, assignments and relevant day
  states only. It excludes email, Personal history and free-form absence notes.
- Cross-unit overlap remains an opaque issue marker produced by canonical coverage; no external
  assignment, requirement, unit or colleague identity is returned.
- Member-day snapshot notes are intentionally omitted from version DTOs.
- Issue copy is represented by a stable `messageKey` plus bounded primitive parameters; the backend
  does not localize manager copy.

## Empty days

Demand and Schedule always return Monday through Sunday. A missing `StaffingPlanDay` becomes a
read-only DTO with `persisted=false`, `planDayId=null` and empty context. GET never calls
`getOrCreate` and never persists a synthetic day.

## Performance model

The query service uses bounded batch reads. Canonical coverage has its established bounded query
set; schedule adds one assignment/member query and, only when relevant members exist, bounded
day-entry/request reads. Snapshot detail uses one query per snapshot collection, independent of row
count. The integration test measures both query mechanisms, not only the explicit JDBC template:

| Schedule fixture | Authorization/unit JPA statements | Aggregate/coverage JDBC statements | Total |
| --- | ---: | ---: | ---: |
| small | 6 | 5 | 11 |
| 12 requirements / 48 assignments | 6 | 10 | 16 |

The five-statement growth is caused by the bounded relevant-member collections, not by row count;
Hibernate authorization remains constant. Version list uses two JDBC statements after the same
constant authorization scope. Version detail uses two statements for authorized conditional
revalidation and seven for a complete snapshot (header plus six bounded collections). No production
pool setting is changed by these measurements.

## Compatibility and future cutover

No existing route is removed or changed. The current authenticated Business UI therefore keeps its
legacy behavior. A later frontend checkpoint can adopt the aggregate reads page by page. Mutations,
`If-Match`, aggregate-native publish, diff, print/export and recommendations remain explicitly out
of C5a.
