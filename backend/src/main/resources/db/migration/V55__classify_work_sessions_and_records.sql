ALTER TABLE work_records ADD COLUMN entry_kind VARCHAR(20);

UPDATE work_records
SET entry_kind = CASE
    WHEN project_id IS NOT NULL OR work_end_date IS NULL THEN 'WORK_SESSION'
    ELSE 'WORK_RECORD'
END;

UPDATE work_records record
SET entry_kind = 'WORK_SESSION'
WHERE EXISTS (
    SELECT 1
    FROM work_intervals tracked_interval
    WHERE tracked_interval.work_session_id = record.id
);

ALTER TABLE work_records ALTER COLUMN entry_kind SET NOT NULL;
ALTER TABLE work_records ALTER COLUMN entry_kind SET DEFAULT 'WORK_SESSION';
ALTER TABLE work_records ADD CONSTRAINT ck_work_records_entry_kind
    CHECK (entry_kind IN ('WORK_SESSION', 'WORK_RECORD'));

CREATE INDEX ix_work_records_entry_kind_date ON work_records(user_id, entry_kind, work_date);
