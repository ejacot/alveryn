ALTER TABLE work_records
    ADD COLUMN IF NOT EXISTS work_end_date DATE;

ALTER TABLE work_records
    ADD CONSTRAINT chk_work_records_date_range
    CHECK (work_end_date IS NULL OR work_end_date >= work_date);

CREATE INDEX IF NOT EXISTS idx_work_records_user_date_range
    ON work_records (user_id, work_date, work_end_date);
