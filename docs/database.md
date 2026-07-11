# Database Design

## Tables

### users

### work_entries
# Roomly database model

Roomly uses PostgreSQL UUID values for every primary and foreign key. All entities inherit `id`, `created_at`, and `updated_at` from the Java `BaseEntity`; timestamps map to `TIMESTAMPTZ`.

## Tables and relationships

- `user_accounts`: credentials, verification and lock state. Status is `ACTIVE`, `LOCKED`, or `DELETED`.
- `user_profiles`: optional onboarding/profile fields; one-to-one with a user.
- `user_preferences`: one-to-one settings using `MONDAY|SUNDAY`, `H12|H24`, and `LIGHT|DARK|SYSTEM`.
- `hourly_rate_periods`: dated, non-negative rates owned by a user. Periods for one user must not overlap.
- `work_types`: user-owned activity definitions, uniquely named per user after normalization. Calculation method is `TIME_BASED` or `UNIT_BASED`.
- `unit_types`: positive unit rates owned by a unit-based work type and uniquely named within it.
- `work_entries`: performed activities; multiple records per user/date are allowed.
- `time_entry_details`: at most one time interval for a time-based entry.
- `unit_entry_items`: positive quantities for unit-based entries, unique by entry and unit type.
- `absences`: inclusive date ranges using `DAY_OFF`, `VACATION`, `SICK_LEAVE`, or `PUBLIC_HOLIDAY`.

Child rows reference their owner lazily in Java. Database foreign keys cascade only where the child has no independent lifecycle. Historical work entries retain snapshots of the work-type name, calculation method, hourly rate, currency, unit name, and unit factor so later configuration changes cannot rewrite history.

Money, rates, quantities, and factors use `NUMERIC`/`BigDecimal`. Worked minutes remain integers. Absences produce neither minutes nor gross amounts. Calculation and same-day conflict services are intentionally deferred.

Gross pay is stored at scale 2 and calculated with `HALF_UP` as `hourly_rate_snapshot × calculated_minutes ÷ 60`. Unit-item minutes are rounded to the nearest whole minute with `HALF_UP` from `quantity × 60 ÷ units_per_hour_snapshot`. V3 mirrors both formulas with PostgreSQL checks and requires uppercase three-letter currency snapshots.

Time intervals are wall-clock intervals: an end later than the start is on the same day; an equal or earlier end is on the next day. Break minutes are subtracted from that interval.

Hourly-rate date ranges are inclusive. Open-ended `valid_to` means infinity. Overlap prevention remains an application-service responsibility backed by the repository overlap query; adjacent periods such as January 1–31 and February 1 onward do not overlap.
