CREATE TABLE IF NOT EXISTS work_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    work_date DATE NOT NULL,
    team_size INTEGER,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_records_user') THEN
        ALTER TABLE work_records
            ADD CONSTRAINT fk_work_records_user
            FOREIGN KEY (user_id) REFERENCES user_accounts (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_records_team_size') THEN
        ALTER TABLE work_records
            ADD CONSTRAINT ck_work_records_team_size
            CHECK (team_size IS NULL OR team_size > 0);
    END IF;
END $$;

ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS work_record_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_entries_work_record') THEN
        ALTER TABLE work_entries
            ADD CONSTRAINT fk_work_entries_work_record
            FOREIGN KEY (work_record_id) REFERENCES work_records (id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_records_user_date ON work_records (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_work_entries_user_work_record ON work_entries (user_id, work_record_id);
