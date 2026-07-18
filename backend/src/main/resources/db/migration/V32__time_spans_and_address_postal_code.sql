ALTER TABLE addresses
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(30);

CREATE TABLE IF NOT EXISTS time_spans (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(30) NOT NULL,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    start_date DATE,
    end_date DATE,
    duration_minutes INTEGER,
    timezone VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_spans_user') THEN
        ALTER TABLE time_spans
            ADD CONSTRAINT fk_time_spans_user
            FOREIGN KEY (user_id) REFERENCES user_accounts (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_time_spans_type') THEN
        ALTER TABLE time_spans
            ADD CONSTRAINT ck_time_spans_type
            CHECK (type IN ('DATETIME_RANGE', 'DATE_RANGE', 'DURATION'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_time_spans_valid_fields') THEN
        ALTER TABLE time_spans
            ADD CONSTRAINT ck_time_spans_valid_fields
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
                    AND end_date IS NOT NULL
                    AND end_date >= start_date
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

ALTER TABLE work_records
    ADD COLUMN IF NOT EXISTS time_span_id UUID;

ALTER TABLE work_record_lines
    ADD COLUMN IF NOT EXISTS time_span_id UUID,
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_records_time_span') THEN
        ALTER TABLE work_records
            ADD CONSTRAINT fk_work_records_time_span
            FOREIGN KEY (time_span_id) REFERENCES time_spans (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_time_span') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT fk_work_record_lines_time_span
            FOREIGN KEY (time_span_id) REFERENCES time_spans (id);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_valid_fields') THEN
        ALTER TABLE work_record_lines DROP CONSTRAINT ck_work_record_lines_valid_fields;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_valid_fields_v2') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT ck_work_record_lines_valid_fields_v2
            CHECK (
                (
                    calculation_mode_snapshot = 'TIME_HOURLY'
                    AND calculated_minutes > 0
                    AND hourly_rate_snapshot IS NOT NULL
                    AND hourly_rate_snapshot >= 0
                    AND quantity IS NULL
                    AND rate_per_unit_snapshot IS NULL
                    AND (
                        (
                            start_time IS NOT NULL
                            AND end_time IS NOT NULL
                            AND break_minutes IS NOT NULL
                            AND break_minutes >= 0
                            AND duration_minutes IS NULL
                        )
                        OR (
                            start_time IS NULL
                            AND end_time IS NULL
                            AND break_minutes IS NULL
                            AND duration_minutes IS NOT NULL
                            AND duration_minutes > 0
                        )
                    )
                )
                OR (
                    calculation_mode_snapshot = 'UNITS_PER_HOUR'
                    AND quantity IS NOT NULL
                    AND quantity > 0
                    AND units_per_hour_snapshot IS NOT NULL
                    AND units_per_hour_snapshot > 0
                    AND calculated_minutes > 0
                    AND hourly_rate_snapshot IS NOT NULL
                    AND hourly_rate_snapshot >= 0
                    AND rate_per_unit_snapshot IS NULL
                )
                OR (
                    calculation_mode_snapshot = 'UNITS_PER_UNIT'
                    AND quantity IS NOT NULL
                    AND quantity > 0
                    AND calculated_minutes >= 0
                    AND rate_per_unit_snapshot IS NOT NULL
                    AND rate_per_unit_snapshot > 0
                    AND hourly_rate_snapshot IS NULL
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_spans_user_type ON time_spans (user_id, type);
CREATE INDEX IF NOT EXISTS idx_work_records_time_span ON work_records (time_span_id);
CREATE INDEX IF NOT EXISTS idx_work_record_lines_time_span ON work_record_lines (time_span_id);
