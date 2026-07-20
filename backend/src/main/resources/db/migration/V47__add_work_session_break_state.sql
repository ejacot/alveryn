ALTER TABLE work_sessions ADD COLUMN pause_started_at TIMESTAMPTZ;
ALTER TABLE work_sessions ADD COLUMN accumulated_break_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE work_sessions ADD CONSTRAINT ck_work_sessions_break_seconds CHECK (accumulated_break_seconds >= 0);
