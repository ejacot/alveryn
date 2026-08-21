CREATE TABLE organization_work_types (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#10B981',
    default_start_time TIME,
    default_end_time TIME,
    default_break_minutes INTEGER NOT NULL DEFAULT 30,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_org_work_type_break CHECK (default_break_minutes >= 0),
    CONSTRAINT ck_org_work_type_times CHECK (default_end_time IS NULL OR default_start_time IS NOT NULL),
    CONSTRAINT ux_org_work_type_code UNIQUE (organization_id, code)
);

CREATE TABLE staffing_requirements (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES organization_units(id) ON DELETE RESTRICT,
    work_type_id UUID NOT NULL REFERENCES organization_work_types(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    required_workers INTEGER NOT NULL,
    required_quantity NUMERIC(12,2),
    notes VARCHAR(500),
    publication_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_required_workers CHECK (required_workers > 0),
    CONSTRAINT ck_staffing_required_quantity CHECK (required_quantity IS NULL OR required_quantity > 0),
    CONSTRAINT ck_staffing_times CHECK (end_time IS NULL OR start_time IS NOT NULL),
    CONSTRAINT ck_staffing_publication CHECK (publication_status IN ('DRAFT', 'PUBLISHED'))
);
CREATE INDEX ix_staffing_requirements_week ON staffing_requirements(organization_id, work_date, unit_id);

CREATE TABLE staffing_assignments (
    id UUID PRIMARY KEY,
    requirement_id UUID NOT NULL REFERENCES staffing_requirements(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
    start_time TIME,
    end_time TIME,
    assignment_status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
    assigned_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_assignment_times CHECK (end_time IS NULL OR start_time IS NOT NULL),
    CONSTRAINT ck_staffing_assignment_status CHECK (assignment_status IN ('ASSIGNED', 'CANCELLED')),
    CONSTRAINT ux_staffing_assignment_member UNIQUE (requirement_id, membership_id)
);
CREATE INDEX ix_staffing_assignments_member ON staffing_assignments(membership_id, assignment_status);
