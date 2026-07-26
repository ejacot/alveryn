# Alveryn Database Model

Current schema version: V67.

Alveryn now tracks work through `work_records` and `work_record_lines`.
`work_types` define both simple formulas and optional parent/child formula groups.
Flyway migrations are the schema authority; Hibernate runs with `ddl-auto: validate`.

## Current Core

- `user_accounts`: authentication, verification, status, lock state.
- `user_profiles`: personal profile, employment dates/type, optional `address_id`.
- `user_preferences`: language, timezone, currency, theme and tracking preferences.
- `addresses`: reusable user-owned addresses; every address component is optional, while the application requires at least one meaningful value before creating an address.
- `employments`: user-owned work contexts and versioned calculation/tracking configuration.
- `work_types`: user-owned work formulas; can be simple or parent/child through `parent_work_type_id`, and explicitly enable extra pay for their record lines.
- `work_projects`: multi-day project identity and metadata, including employment, date boundaries, optional address and lifecycle status.
- `work_records`: one dated job/session or a project-total record, with optional project, address, team size and notes.
- `work_record_lines`: performed work lines inside a record, each pointing to a `work_type` and storing immutable input plus worked, extra and total time/money result snapshots.
- `work_intervals`: timer/manual intervals attached to work sessions.
- `hourly_rate_periods`: user-owned hourly rates with validity periods.
- `absence_types`: user-owned paid/unpaid absence definitions.
- `absences`: historical absences with absence-type snapshots.
- `employment_rest_days`: explicit manual rest-day classification per employment and date.
- `organizations` and `organization_memberships`: workspace ownership foundation; each personal account has its own personal organization.
- `schedule_templates`, `schedule_template_rules`, `scheduled_shifts`, `shift_breaks`, `shift_assignments`, and `shift_change_requests`: versioned scheduling foundation retained for future coordinated work without coupling the personal UI to business flows.
- `user_activity_days`: one privacy-minimised activity heartbeat per user and UTC day.
- `product_events`: allowlisted product events such as successful PDF exports, without work content.
- `admin_audit_events`: audit trail for access to the private Founder dashboard.

## Founder analytics

`user_accounts.role` separates normal users from the single configured Founder account. The
Founder identity is supplied through `FOUNDER_EMAIL` at deployment time and is never exposed
through a role-management API. Founder metrics exclude admin accounts and aggregate product
adoption without storing page paths, IP addresses, notes, earnings or work-line content.

## Removed Legacy Tables

These are dropped by the latest migrations and should not be used by active code:

- `work_entries`
- `time_entry_details`
- `excel_import_batches`
- `unit_types`
- `unit_entry_items`
- `work_type_configurations`
- `time_spans`

Old Flyway migrations still mention them because they describe historical schema evolution.
V34 removes the legacy Excel import and work-entry tables from the final schema.
V36 removes `time_spans`; periods now live directly on the owning tables.
V38 makes extra pay an explicit WorkType capability, V39 permits it for every calculation mode, and V40 adds explicit worked, extra and total result snapshots without deleting historical records.
V41 adds the non-negative `user_preferences.guide_version_completed` marker. Existing accounts receive version `0`, so newly released mandatory guides can be shown safely without changing or deleting user work data.
V44 promotes employment into a first-class aggregate, backfills a primary employment for every existing account, links existing work types and records without deleting legacy profile data, and adds `TIME_ONLY` record snapshots for fixed-salary hour tracking. Versions 42–43 remain reserved for the previously deployed compatibility migrations.
V45–V47 version employment terms and add persisted work intervals with break state.
V48 introduces `work_projects`, links project sessions, and renames the timer/session detail tables to their current terminology.
V49–V56 scope rates and absences to employment, add balance validity, tracking focus, entry classification, and versioned tracking setup.
V57–V60 add privacy-minimised Founder and acquisition analytics plus cascading audit cleanup.
V61–V65 establish personal organizations and the versioned scheduling model, including recurring occurrences, multiple activities per day, and absence rules.
V66 adds explicit employment rest days.
V67 makes individual address fields optional so partial addresses can be stored safely.
