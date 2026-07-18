DROP INDEX IF EXISTS idx_work_record_lines_time_span;
DROP INDEX IF EXISTS idx_work_records_time_span;
DROP INDEX IF EXISTS idx_user_profiles_employment_time_span;
DROP INDEX IF EXISTS idx_hourly_rate_periods_time_span;
DROP INDEX IF EXISTS idx_absences_time_span;
DROP INDEX IF EXISTS idx_time_spans_user_date_range;
DROP INDEX IF EXISTS idx_time_spans_user_type;

ALTER TABLE IF EXISTS work_record_lines
    DROP CONSTRAINT IF EXISTS fk_work_record_lines_time_span;

ALTER TABLE IF EXISTS work_records
    DROP CONSTRAINT IF EXISTS fk_work_records_time_span;

ALTER TABLE IF EXISTS user_profiles
    DROP CONSTRAINT IF EXISTS fk_user_profiles_employment_time_span;

ALTER TABLE IF EXISTS hourly_rate_periods
    DROP CONSTRAINT IF EXISTS fk_hourly_rate_periods_time_span;

ALTER TABLE IF EXISTS absences
    DROP CONSTRAINT IF EXISTS fk_absences_time_span;

ALTER TABLE IF EXISTS work_record_lines
    DROP COLUMN IF EXISTS time_span_id;

ALTER TABLE IF EXISTS work_records
    DROP COLUMN IF EXISTS time_span_id;

ALTER TABLE IF EXISTS user_profiles
    DROP COLUMN IF EXISTS employment_time_span_id;

ALTER TABLE IF EXISTS hourly_rate_periods
    DROP COLUMN IF EXISTS time_span_id;

ALTER TABLE IF EXISTS absences
    DROP COLUMN IF EXISTS time_span_id;

DROP TABLE IF EXISTS time_spans;
