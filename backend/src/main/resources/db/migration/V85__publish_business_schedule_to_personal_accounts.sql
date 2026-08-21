ALTER TABLE staffing_requirements ADD COLUMN published_at TIMESTAMPTZ;
CREATE TABLE staffing_schedule_receipts (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
 week_start DATE NOT NULL, viewed_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ux_staffing_schedule_receipt UNIQUE (organization_id, membership_id, week_start)
);
