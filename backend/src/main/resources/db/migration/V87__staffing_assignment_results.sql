CREATE TABLE staffing_assignment_results (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL UNIQUE REFERENCES staffing_assignments(id) ON DELETE CASCADE,
    actual_start_time TIME,
    actual_end_time TIME,
    break_minutes INTEGER NOT NULL DEFAULT 30,
    completed_quantity NUMERIC(12,2),
    notes VARCHAR(1000),
    approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_result_times CHECK (actual_end_time IS NULL OR actual_start_time IS NOT NULL),
    CONSTRAINT ck_staffing_result_break CHECK (break_minutes >= 0),
    CONSTRAINT ck_staffing_result_quantity CHECK (completed_quantity IS NULL OR completed_quantity >= 0),
    CONSTRAINT ck_staffing_result_status CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED'))
);
CREATE INDEX ix_staffing_results_status ON staffing_assignment_results(approval_status, submitted_at);
