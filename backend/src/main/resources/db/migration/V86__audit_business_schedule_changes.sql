CREATE TABLE staffing_change_events (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 actor_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
 event_type VARCHAR(40) NOT NULL, entity_type VARCHAR(30) NOT NULL, entity_id UUID,
 work_date DATE, summary VARCHAR(500) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_staffing_change_events_org_created ON staffing_change_events(organization_id, created_at DESC);
