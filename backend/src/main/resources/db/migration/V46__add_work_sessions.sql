CREATE TABLE work_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    employment_id UUID NOT NULL REFERENCES employments(id),
    work_type_id UUID NOT NULL REFERENCES work_types(id),
    work_record_id UUID REFERENCES work_records(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL,
    checked_out_at TIMESTAMPTZ,
    timezone VARCHAR(60) NOT NULL,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_work_sessions_break CHECK (break_minutes >= 0),
    CONSTRAINT ck_work_sessions_interval CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

CREATE UNIQUE INDEX ux_work_sessions_active_user ON work_sessions(user_id) WHERE checked_out_at IS NULL;
CREATE INDEX ix_work_sessions_employment ON work_sessions(employment_id, checked_in_at);
