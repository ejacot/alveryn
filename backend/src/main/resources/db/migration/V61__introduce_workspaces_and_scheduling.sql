CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    personal_owner_user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    organization_type VARCHAR(20) NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_organizations_type CHECK (organization_type IN ('PERSONAL', 'BUSINESS')),
    CONSTRAINT ck_organizations_personal_owner CHECK (
        (organization_type = 'PERSONAL' AND personal_owner_user_id IS NOT NULL)
        OR (organization_type = 'BUSINESS' AND personal_owner_user_id IS NULL)
    ),
    CONSTRAINT ux_organizations_personal_owner UNIQUE (personal_owner_user_id)
);

CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    membership_role VARCHAR(20) NOT NULL,
    membership_status VARCHAR(20) NOT NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_memberships_role CHECK (membership_role IN ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
    CONSTRAINT ck_memberships_status CHECK (membership_status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
    CONSTRAINT ux_memberships_organization_user UNIQUE (organization_id, user_id)
);

CREATE INDEX ix_memberships_user_status
    ON organization_memberships(user_id, membership_status);

INSERT INTO organizations (id, personal_owner_user_id, name, organization_type, timezone)
SELECT gen_random_uuid(), u.id,
       COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), u.email),
       'PERSONAL',
       COALESCE(NULLIF(pref.timezone, ''), 'UTC')
FROM user_accounts u
LEFT JOIN user_profiles p ON p.user_id = u.id
LEFT JOIN user_preferences pref ON pref.user_id = u.id;

INSERT INTO organization_memberships (
    id, organization_id, user_id, membership_role, membership_status, joined_at
)
SELECT gen_random_uuid(), o.id, u.id, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
FROM user_accounts u
JOIN organizations o
  ON o.organization_type = 'PERSONAL'
 AND o.personal_owner_user_id = u.id;

ALTER TABLE employments ADD COLUMN organization_id UUID;

UPDATE employments e
SET organization_id = m.organization_id
FROM organization_memberships m
JOIN organizations o ON o.id = m.organization_id AND o.organization_type = 'PERSONAL'
WHERE m.user_id = e.user_id
  AND m.membership_role = 'OWNER'
  AND m.membership_status = 'ACTIVE';

ALTER TABLE employments
    ADD CONSTRAINT fk_employments_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX ix_employments_organization
    ON employments(organization_id, active, display_order);

CREATE TABLE schedule_templates (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    version INTEGER NOT NULL,
    template_status VARCHAR(20) NOT NULL,
    created_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_schedule_template_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT ck_schedule_template_version CHECK (version > 0),
    CONSTRAINT ck_schedule_template_status CHECK (template_status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ux_schedule_template_version UNIQUE (employment_id, version)
);

CREATE INDEX ix_schedule_templates_effective
    ON schedule_templates(employment_id, valid_from, valid_to, template_status);

CREATE TABLE schedule_template_rules (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    start_local_time TIME NOT NULL,
    end_local_time TIME NOT NULL,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_schedule_rule_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_schedule_rule_time CHECK (end_local_time > start_local_time),
    CONSTRAINT ck_schedule_rule_break CHECK (break_minutes >= 0),
    CONSTRAINT ux_schedule_rule_day UNIQUE (template_id, day_of_week)
);

CREATE TABLE scheduled_shifts (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_rule_id UUID REFERENCES schedule_template_rules(id) ON DELETE SET NULL,
    project_id UUID REFERENCES work_projects(id) ON DELETE SET NULL,
    address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    required_workers INTEGER NOT NULL DEFAULT 1,
    shift_status VARCHAR(20) NOT NULL,
    shift_source VARCHAR(30) NOT NULL,
    manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    published_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_scheduled_shift_times CHECK (ends_at > starts_at),
    CONSTRAINT ck_scheduled_shift_workers CHECK (required_workers > 0),
    CONSTRAINT ck_scheduled_shift_version CHECK (version > 0),
    CONSTRAINT ck_scheduled_shift_status CHECK (shift_status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT ck_scheduled_shift_source CHECK (shift_source IN ('RECURRING_TEMPLATE', 'MANUAL', 'IMPORTED'))
);

CREATE INDEX ix_scheduled_shifts_organization_time
    ON scheduled_shifts(organization_id, starts_at, ends_at);

CREATE TABLE shift_breaks (
    id UUID PRIMARY KEY,
    shift_id UUID NOT NULL REFERENCES scheduled_shifts(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    planned_minutes INTEGER NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_shift_break_minutes CHECK (planned_minutes >= 0),
    CONSTRAINT ck_shift_break_times CHECK (
        (starts_at IS NULL AND ends_at IS NULL)
        OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)
    )
);

CREATE TABLE shift_assignments (
    id UUID PRIMARY KEY,
    shift_id UUID NOT NULL REFERENCES scheduled_shifts(id) ON DELETE CASCADE,
    employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    worker_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    assignment_status VARCHAR(20) NOT NULL,
    assigned_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_shift_assignment_status CHECK (
        assignment_status IN ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'CANCELLED')
    ),
    CONSTRAINT ux_shift_assignment_worker UNIQUE (shift_id, worker_membership_id)
);

CREATE INDEX ix_shift_assignments_employment
    ON shift_assignments(employment_id, assignment_status);

CREATE TABLE shift_change_requests (
    id UUID PRIMARY KEY,
    shift_assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    requested_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    request_type VARCHAR(20) NOT NULL,
    proposed_start TIMESTAMPTZ,
    proposed_end TIMESTAMPTZ,
    reason VARCHAR(500),
    request_status VARCHAR(20) NOT NULL,
    decided_by_membership_id UUID REFERENCES organization_memberships(id),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_shift_change_type CHECK (request_type IN ('TIME_CHANGE', 'SWAP', 'DROP', 'ABSENCE')),
    CONSTRAINT ck_shift_change_status CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_shift_change_times CHECK (
        proposed_end IS NULL OR proposed_start IS NULL OR proposed_end > proposed_start
    )
);

ALTER TABLE work_records ADD COLUMN shift_assignment_id UUID;
ALTER TABLE work_records
    ADD CONSTRAINT fk_work_records_shift_assignment
        FOREIGN KEY (shift_assignment_id) REFERENCES shift_assignments(id) ON DELETE SET NULL;
CREATE INDEX ix_work_records_shift_assignment
    ON work_records(shift_assignment_id);
