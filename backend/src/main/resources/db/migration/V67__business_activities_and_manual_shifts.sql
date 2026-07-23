CREATE TABLE organization_activities (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    default_break_minutes INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_organization_activity_name UNIQUE (organization_id, normalized_name),
    CONSTRAINT ck_organization_activity_break CHECK (default_break_minutes >= 0),
    CONSTRAINT ck_organization_activity_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

ALTER TABLE scheduled_shifts
    ADD COLUMN organization_activity_id UUID REFERENCES organization_activities(id) ON DELETE SET NULL,
    ADD COLUMN activity_name_snapshot VARCHAR(100),
    ADD COLUMN activity_color_snapshot VARCHAR(7);

CREATE INDEX ix_organization_activities_active
    ON organization_activities(organization_id, active, display_order);
CREATE INDEX ix_shift_assignments_worker_time
    ON shift_assignments(worker_membership_id, assignment_status);
