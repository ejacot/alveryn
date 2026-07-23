ALTER TABLE organizations
    ADD COLUMN business_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD CONSTRAINT ck_organizations_business_status CHECK (business_status IN ('ACTIVE', 'SUSPENDED'));

CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    membership_role VARCHAR(20) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    invited_by_membership_id UUID NOT NULL REFERENCES organization_memberships(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_organization_invitation_token UNIQUE (token_hash),
    CONSTRAINT ck_organization_invitation_role CHECK (membership_role IN ('ADMIN', 'MANAGER', 'EMPLOYEE'))
);

CREATE INDEX ix_organization_invitations_email
    ON organization_invitations(normalized_email, expires_at);
CREATE UNIQUE INDEX ux_organization_pending_invitation
    ON organization_invitations(organization_id, normalized_email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
