# Business draft mutation audit (C4a)

This audit defines which Business operations change the weekly planning source consumed by atomic
publication. The weekly `StaffingPlan` is the lock and revision boundary. Current public planner
routes predate the weekly aggregate and are therefore explicitly classified
`LEGACY_UNCONDITIONAL`: they do not yet accept `If-Match`, but they must acquire the plan lock and
increment `draft_revision` once per logical operation. No atomic weekly publish endpoint is exposed
in C4a.

| Mutation | Planning effect | C4a revision policy | HTTP concurrency |
| --- | --- | --- | --- |
| Create one/bulk requirements | Demand and plan-day source | Lock affected weeks; attach every requirement to its plan day; increment each affected plan once | `LEGACY_UNCONDITIONAL` |
| Update/delete requirement | Demand, interval, notes | Lock requirement plan; no-op = 0, change = 1 | `LEGACY_UNCONDITIONAL` |
| Create/update/cancel assignment | Planned person and interval | Lock requirement plan; no-op = 0, change = 1 | `LEGACY_UNCONDITIONAL` |
| Legacy publish flag | Legacy employee visibility only; still part of source snapshot | Lock all affected plans; increment each plan once when at least one flag changes | `LEGACY_UNCONDITIONAL` |
| Set/remove member day | Availability, review and effective coverage when the member is assigned | Lock plans containing that member/date; no-op = 0, change = 1 | `LEGACY_UNCONDITIONAL` |
| Create/decide absence request | Pending warning or approved member-day status | Lock plans containing that member in the request range; increment once per affected plan | `LEGACY_UNCONDITIONAL` |
| Update/deactivate referenced work type | Snapshot label, interval defaults, active blocker | Lock every plan referencing the work type; no-op = 0, change = 1 | `LEGACY_UNCONDITIONAL` |
| Suspend/reactivate/claim assigned membership | Effective coverage and membership snapshot | Lock every plan assigning the member; no-op = 0, change = 1 | `LEGACY_UNCONDITIONAL` or internal auth transition |
| Assignment result, check-in/out, actual approval | Operational actual work; not weekly planning | Excluded from the publication source fingerprint and new atomic snapshots; revision unchanged | Not a planning mutation |
| Create organization/unit/member/work type/role | No existing weekly plan references the new entity | Revision unchanged | Outside plan aggregate |

## Exact publication-source ownership

The table below is exhaustive for `StaffingPlanPublicationWriter.sourceFingerprint`. “Immutable”
means that the current Business domain and HTTP API expose no rename/reparent/update operation for
that value; this is checked by integration/architecture tests for unit labels, membership labels and
plan-day context. Direct SQL is not an application mutation contract.

| Fingerprint section and fields | Mutation owner / conclusion |
| --- | --- |
| Plan: organization ID, unit ID, week start, timezone | Set once by `StaffingPlanFactory`; immutable (B) |
| Plan: `draft_revision` | Owned exclusively by `StaffingPlanMutationCoordinator.finish` (A) |
| Plan day: source ID, date, rooms context, notes, source | Created through coordinator-backed `createDay` or requirement creation; there is no public context/date reparent mutation (A/B) |
| Requirement: source ID, plan-day ID, date, unit ID, work-type ID | Create/delete are coordinated; update DTO explicitly rejects reparenting to another date/unit/work type (A) |
| Requirement: unit display name | Unit names have no update API/domain mutator in the current model (B) |
| Requirement: work-type code/name/default break/active | Referenced work-type update/deactivate locks all plans and revisions them (A) |
| Requirement: start/end, required workers/quantity, notes | Requirement update/delete is coordinator-backed; no-op is detected (A) |
| Requirement: legacy publication status | Legacy publish locks all affected plans and revisions only plans whose flag changed (A) |
| Assignment: source/requirement/member IDs, start/end, assignment status | Create, time update and cancellation lock the requirement plan (A) |
| Assignment: membership status | Suspend/reactivate and invitation claim lock every plan assigning the member (A) |
| Assignment/member day: member first/last display label | Membership display labels are create-only in the current Business model; claimed user profile names are not read into this snapshot label (B) |
| Assignment: unit name/check-in mode | Both are create-only in the current Business unit model (B) |
| Assignment: work-type code/name/active | Same coordinated work-type owner as requirement snapshot labels (A) |
| Member day: source ID, member ID/name, date, status, notes | Set/remove day entry and approved absence decisions are coordinated for assigned member/week scopes (A) |
| Pending absence: source ID, member ID, type, start/end, pending status | Create and decision are coordinated for assigned member/week scopes (A) |
| Pending absence note/reviewer/timestamps | Deliberately absent: review identity/relevance and snapshots do not consume them (C) |
| Assignment actual result, check-in/out and approval | Deliberately absent from the planning source and atomic snapshot (C) |
| Assignment secondary responsibility | The legacy model has no such field yet; atomic publish remains unexposed until an aggregate-native mutation owner exists (D) |

There are no remaining mutable fingerprint fields without an A/B/C/D conclusion. The explicit
limitations in category D are another reason `publishPlan` remains internal in C4a.

## Locking and revision rules

- Acquire all affected `StaffingPlan` rows first, ordered by plan UUID.
- Resolve/create the required `StaffingPlanDay` after the plan locks and before child mutation.
- Mutate requirements, assignments, member days or referenced metadata only after plan locks.
- Increment `draft_revision` exactly once per affected plan and logical operation.
- A validated no-op must not increment the revision.
- A failed transaction rolls back the child mutation and revision together.
- `StaffingPlannerService`, `BusinessOrganizationService`, `AuthService` and
  `StaffingPlanFoundationService` enter the coordinator through a separate Spring bean. Their
  public mutation methods already have a real transaction; coordinator propagation is the default
  `REQUIRED`, the callback opens no `REQUIRES_NEW`, and every plan lock is held on that transaction
  until child mutation and revision complete. Fault-injection tests prove rollback through both the
  planner and organization services, not only by calling the coordinator directly.
- Operational reads and writes remain tenant- and unit-scoped; a foreign valid UUID is treated as
  not found.

## Requirement identity and first-plan creation

- `RequirementUpdateRequest` permits editing only the interval, workers, quantity and notes.
  Optional identity fields are accepted solely to reject a changed date, unit or work type with a
  validation error. A requirement cannot be reparented; the supported operation is delete and
  recreate. The entity also refuses attachment to a second plan day.
- First creation of a weekly plan locks the stable `OrganizationUnit` parent row before checking
  the unique `(organization_id, unit_id, week_start)` key. Concurrent create/bulk operations for a
  previously absent week therefore serialize before insert, reuse one plan and one day, and never
  rely on recovering a transaction after a unique-key exception. The concurrency test proves one
  plan, one plan day, two attached requirements and zero orphans.

## HTTP conditionality boundary

C4a does not introduce a new Demand/Schedule API, so there are no new planner routes on which to
require `If-Match`. Existing routes remain temporarily unconditional for compatibility, but are
serialized and revisioned by the aggregate coordinator. The future aggregate-native mutation
routes must:

1. return the plan ETag (`"plan-{planId}-r{draftRevision}"`);
2. require `If-Match` and return 428 when absent;
3. return 412 for a stale revision;
4. never silently overwrite another manager's change.

The existing atomic publication service remains internal and unexposed until all production
planning mutations use this boundary.

## Exact legacy mutation routes

The following existing HTTP mutations remain `LEGACY_UNCONDITIONAL` in C4a. They now serialize on
the weekly aggregate and maintain its revision, but their compatibility contract does not yet
require `If-Match` or return the plan ETag:

- `PUT/DELETE /api/organizations/{organizationId}/staffing/work-types/{workTypeId}`;
- `POST /api/organizations/{organizationId}/staffing/requirements`;
- `POST /api/organizations/{organizationId}/staffing/requirements/bulk`;
- `PUT/DELETE /api/organizations/{organizationId}/staffing/requirements/{requirementId}`;
- `POST /api/organizations/{organizationId}/staffing/requirements/{requirementId}/assignments`;
- `PUT/DELETE /api/organizations/{organizationId}/staffing/requirements/{requirementId}/assignments/{assignmentId}`;
- `POST /api/organizations/{organizationId}/staffing/publish` (legacy publication flags only);
- `PUT/DELETE /api/organizations/{organizationId}/staffing/members/{membershipId}/days/{date}`;
- `POST /api/my/business-schedule/absence-requests`;
- `PUT /api/organizations/{organizationId}/staffing/absence-requests/{requestId}/decision`;
- `DELETE /api/organizations/{organizationId}/members/{membershipId}`;
- `POST /api/organizations/{organizationId}/members/{membershipId}/reactivate`;
- the internal invitation-claim transition after email verification.

`POST /work-types` does not increment a plan because a newly created work type cannot yet be
referenced by one. Assignment results, manager approval, check-in and check-out are deliberately
outside the planning snapshot and do not change `draft_revision`.

There are no aggregate-native Demand/Schedule mutation routes in C4a, so there is no new HTTP
contract on which a missing `If-Match` could correctly return 428. The coordinator's expected
revision and stable ETag path are integration-tested now; 428/412 response coverage belongs to the
future routes that consume it. Until that cutover, legacy concurrent writes are serialized but
remain intentionally last-command-wins at the HTTP contract level, and atomic weekly publication
must stay unexposed.
