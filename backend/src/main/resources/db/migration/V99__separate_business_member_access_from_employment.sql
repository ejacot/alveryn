ALTER TABLE organization_memberships
    ADD COLUMN access_state VARCHAR(20) NOT NULL DEFAULT 'CLAIMED';

UPDATE organization_memberships
SET access_state = CASE
    WHEN user_id IS NOT NULL THEN 'CLAIMED'
    WHEN invited_email IS NOT NULL THEN 'INVITED'
    ELSE 'MANAGED'
END;

ALTER TABLE organization_memberships
    ADD CONSTRAINT ck_organization_memberships_access_state
        CHECK (access_state IN ('MANAGED', 'INVITED', 'CLAIMED'));
