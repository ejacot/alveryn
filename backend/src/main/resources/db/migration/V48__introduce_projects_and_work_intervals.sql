CREATE TABLE work_projects (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    employment_id UUID NOT NULL REFERENCES employments(id),
    address_id UUID REFERENCES addresses(id),
    title VARCHAR(160) NOT NULL,
    description VARCHAR(1000),
    client_name VARCHAR(160),
    reference VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_work_projects_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_work_projects_status CHECK (status IN ('PLANNED','ACTIVE','COMPLETED','ARCHIVED'))
);
CREATE INDEX ix_work_projects_user_status ON work_projects(user_id, status, start_date);
CREATE INDEX ix_work_projects_employment ON work_projects(employment_id, start_date);

ALTER TABLE work_records ADD COLUMN project_id UUID REFERENCES work_projects(id);
CREATE INDEX ix_work_records_project_date ON work_records(project_id, work_date);

ALTER TABLE work_sessions RENAME TO work_intervals;
ALTER TABLE work_intervals RENAME COLUMN work_record_id TO work_session_id;
ALTER INDEX ux_work_sessions_active_user RENAME TO ux_work_intervals_active_user;
ALTER INDEX ix_work_sessions_employment RENAME TO ix_work_intervals_employment;

ALTER TABLE work_record_lines RENAME COLUMN work_record_id TO work_session_id;
ALTER INDEX idx_work_record_lines_record RENAME TO idx_work_record_lines_session;
