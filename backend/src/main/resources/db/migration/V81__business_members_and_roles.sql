ALTER TABLE organization_memberships ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE organization_memberships ADD COLUMN first_name VARCHAR(100);
ALTER TABLE organization_memberships ADD COLUMN last_name VARCHAR(100);
ALTER TABLE organization_memberships ADD COLUMN invited_email VARCHAR(320);
ALTER TABLE organization_memberships ADD COLUMN ended_at TIMESTAMPTZ;

ALTER TABLE organization_memberships DROP CONSTRAINT ux_memberships_organization_user;
CREATE UNIQUE INDEX ux_memberships_organization_user
    ON organization_memberships(organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX ux_memberships_organization_invited_email
    ON organization_memberships(organization_id, LOWER(invited_email)) WHERE invited_email IS NOT NULL;
ALTER TABLE organization_memberships ADD CONSTRAINT ck_membership_identity CHECK (
    user_id IS NOT NULL OR NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') IS NOT NULL
);

CREATE TABLE organization_roles (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_organization_roles_name UNIQUE (organization_id, name)
);

CREATE TABLE organization_role_assignments (
    id UUID PRIMARY KEY,
    membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES organization_units(id) ON DELETE CASCADE,
    include_descendants BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_role_assignment_scope
    ON organization_role_assignments(membership_id, role_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX ix_role_assignments_member ON organization_role_assignments(membership_id);
CREATE INDEX ix_role_assignments_unit ON organization_role_assignments(unit_id);
