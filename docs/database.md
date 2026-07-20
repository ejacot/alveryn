# Alveryn Database Model

Current schema version: V43.

Alveryn now tracks work through `work_records` and `work_record_lines`.
`work_types` define both simple formulas and optional parent/child formula groups.

## Current Core

- `user_accounts`: authentication, verification, status, lock state.
- `user_profiles`: personal profile, employment dates/type, optional `address_id`.
- `user_preferences`: language, timezone, currency, theme and tracking preferences.
- `addresses`: reusable user-owned addresses.
- `work_types`: user-owned work formulas; can be simple or parent/child through `parent_work_type_id`, and explicitly enable extra pay for their record lines.
- `work_records`: one job or multi-day project for a user, with start/end dates, optional address, team size and notes.
- `work_record_lines`: performed work lines inside a record, each pointing to a `work_type` and storing immutable input plus worked, extra and total time/money result snapshots.
- `hourly_rate_periods`: user-owned hourly rates with validity periods.
- `absence_types`: user-owned paid/unpaid absence definitions.
- `absences`: historical absences with absence-type snapshots.

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
