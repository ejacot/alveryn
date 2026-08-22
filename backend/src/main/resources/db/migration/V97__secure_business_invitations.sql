ALTER TABLE organization_memberships
    ADD COLUMN invitation_token_hash VARCHAR(64),
    ADD COLUMN invitation_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX ux_organization_memberships_invitation_token
    ON organization_memberships(invitation_token_hash)
    WHERE invitation_token_hash IS NOT NULL;

ALTER TABLE organization_memberships ADD CONSTRAINT ck_membership_invitation_token
    CHECK ((invitation_token_hash IS NULL) = (invitation_expires_at IS NULL));
