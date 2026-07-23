# ADR 0004: Workspace-owned, versioned scheduling

## Status

Accepted

## Context

Alveryn originally attached employments and work data directly to a user account. A recurring
personal schedule could therefore have been implemented as another user-owned setting, but that
model would not support company planners, multiple workers, published shifts, or approval flows
without replacing it.

Planned time and actual work also have different lifecycles. Editing a plan must not rewrite a
confirmed work record, and changing a recurring week must not change historical plans.

## Decision

- Every account has a personal organization and an owner membership. Business organizations use
  the same organization and membership model with additional roles.
- Employments belong to an organization while retaining their current worker link during the
  transition from the individual-only product.
- A `schedule_template` is effective-dated and versioned. Changing all future weeks closes the
  active version and creates a new one.
- Template rules store weekday and local wall-clock time together with an IANA timezone.
- Rules are materialized into concrete `scheduled_shifts` for a rolling twelve-week horizon.
- Workers are connected to shifts through `shift_assignments`; a shift is not owned directly by a
  user.
- Editing one concrete day marks the shift as manually overridden. Regeneration never deletes
  manually overridden shifts.
- `work_records` may reference a shift assignment, but remain valid without one. Planned and actual
  time are separate facts.
- Change requests and assignment states are represented in the schema now so business approvals
  can be added without replacing the scheduling aggregate.

## Consequences

- Personal scheduling and future company scheduling share one storage and permission model.
- Historical schedule versions remain auditable.
- Daylight-saving transitions are resolved when concrete shifts are materialized.
- The initial save materializes twelve weeks. Range reads extend the horizon idempotently, using a
  unique template-rule/occurrence-date identity, so schedules do not silently stop after that window.
- Existing APIs may continue to authorize by the worker during the personal-product phase. Business
  APIs must authorize through organization membership and role.
