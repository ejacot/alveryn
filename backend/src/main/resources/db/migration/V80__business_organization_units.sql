CREATE TABLE organization_units (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES organization_units(id) ON DELETE RESTRICT,
    name VARCHAR(160) NOT NULL,
    unit_type VARCHAR(40) NOT NULL DEFAULT 'TEAM',
    check_in_mode VARCHAR(20) NOT NULL DEFAULT 'OPTIONAL',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_organization_units_type CHECK (unit_type IN ('LOCATION', 'DEPARTMENT', 'TEAM', 'OTHER')),
    CONSTRAINT ck_organization_units_check_in CHECK (check_in_mode IN ('DISABLED', 'OPTIONAL', 'REQUIRED')),
    CONSTRAINT ck_organization_units_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT ux_organization_units_sibling_name UNIQUE NULLS NOT DISTINCT (organization_id, parent_id, name)
);

CREATE INDEX ix_organization_units_tree
    ON organization_units(organization_id, parent_id, active, display_order, name);

CREATE TABLE organization_unit_memberships (
    id UUID PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES organization_units(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_on DATE,
    ended_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_unit_membership_dates CHECK (ended_on IS NULL OR joined_on IS NULL OR ended_on >= joined_on),
    CONSTRAINT ux_unit_membership UNIQUE (unit_id, membership_id)
);

CREATE INDEX ix_unit_memberships_member
    ON organization_unit_memberships(membership_id, active);
