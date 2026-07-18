DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_time_spans_valid_fields'
          AND conrelid = 'time_spans'::regclass
    ) THEN
        ALTER TABLE time_spans DROP CONSTRAINT ck_time_spans_valid_fields;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_time_spans_valid_fields_v2'
          AND conrelid = 'time_spans'::regclass
    ) THEN
        ALTER TABLE time_spans
            ADD CONSTRAINT ck_time_spans_valid_fields_v2
            CHECK (
                (
                    type = 'DATETIME_RANGE'
                    AND start_at IS NOT NULL
                    AND end_at IS NOT NULL
                    AND end_at > start_at
                    AND start_date IS NULL
                    AND end_date IS NULL
                    AND duration_minutes IS NULL
                )
                OR (
                    type = 'DATE_RANGE'
                    AND start_date IS NOT NULL
                    AND (end_date IS NULL OR end_date >= start_date)
                    AND start_at IS NULL
                    AND end_at IS NULL
                    AND duration_minutes IS NULL
                )
                OR (
                    type = 'DURATION'
                    AND duration_minutes IS NOT NULL
                    AND duration_minutes > 0
                    AND start_at IS NULL
                    AND end_at IS NULL
                    AND start_date IS NULL
                    AND end_date IS NULL
                )
            );
    END IF;
END $$;

ALTER TABLE absences
    ADD COLUMN IF NOT EXISTS time_span_id UUID;

ALTER TABLE hourly_rate_periods
    ADD COLUMN IF NOT EXISTS time_span_id UUID;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS employment_time_span_id UUID;

DO $$
DECLARE
    row_record RECORD;
    span_id UUID;
BEGIN
    FOR row_record IN
        SELECT id, user_id, start_date, end_date
        FROM absences
        WHERE time_span_id IS NULL
    LOOP
        span_id := gen_random_uuid();
        INSERT INTO time_spans (id, user_id, type, start_date, end_date, created_at, updated_at)
        VALUES (span_id, row_record.user_id, 'DATE_RANGE', row_record.start_date, row_record.end_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        UPDATE absences SET time_span_id = span_id WHERE id = row_record.id;
    END LOOP;

    FOR row_record IN
        SELECT id, user_id, valid_from, valid_to
        FROM hourly_rate_periods
        WHERE time_span_id IS NULL
    LOOP
        span_id := gen_random_uuid();
        INSERT INTO time_spans (id, user_id, type, start_date, end_date, created_at, updated_at)
        VALUES (span_id, row_record.user_id, 'DATE_RANGE', row_record.valid_from, row_record.valid_to, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        UPDATE hourly_rate_periods SET time_span_id = span_id WHERE id = row_record.id;
    END LOOP;

    FOR row_record IN
        SELECT id, user_id, employment_start_date, employment_end_date
        FROM user_profiles
        WHERE employment_time_span_id IS NULL
          AND employment_start_date IS NOT NULL
    LOOP
        span_id := gen_random_uuid();
        INSERT INTO time_spans (id, user_id, type, start_date, end_date, created_at, updated_at)
        VALUES (span_id, row_record.user_id, 'DATE_RANGE', row_record.employment_start_date, row_record.employment_end_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        UPDATE user_profiles SET employment_time_span_id = span_id WHERE id = row_record.id;
    END LOOP;

    FOR row_record IN
        SELECT id, user_id, work_date
        FROM work_records
        WHERE time_span_id IS NULL
    LOOP
        span_id := gen_random_uuid();
        INSERT INTO time_spans (id, user_id, type, start_date, end_date, created_at, updated_at)
        VALUES (span_id, row_record.user_id, 'DATE_RANGE', row_record.work_date, row_record.work_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        UPDATE work_records SET time_span_id = span_id WHERE id = row_record.id;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_absences_time_span') THEN
        ALTER TABLE absences
            ADD CONSTRAINT fk_absences_time_span
            FOREIGN KEY (time_span_id) REFERENCES time_spans (id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hourly_rate_periods_time_span') THEN
        ALTER TABLE hourly_rate_periods
            ADD CONSTRAINT fk_hourly_rate_periods_time_span
            FOREIGN KEY (time_span_id) REFERENCES time_spans (id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_profiles_employment_time_span') THEN
        ALTER TABLE user_profiles
            ADD CONSTRAINT fk_user_profiles_employment_time_span
            FOREIGN KEY (employment_time_span_id) REFERENCES time_spans (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_absences_time_span ON absences (time_span_id);
CREATE INDEX IF NOT EXISTS idx_hourly_rate_periods_time_span ON hourly_rate_periods (time_span_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employment_time_span ON user_profiles (employment_time_span_id);
CREATE INDEX IF NOT EXISTS idx_time_spans_user_date_range ON time_spans (user_id, start_date, end_date);
