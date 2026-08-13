CREATE TABLE staffing_member_day_entries (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    entry_type VARCHAR(20) NOT NULL,
    notes VARCHAR(500),
    created_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_day_entry_type CHECK (entry_type IN ('REST_DAY', 'VACATION', 'SICK')),
    CONSTRAINT ux_staffing_member_day_entry UNIQUE (membership_id, work_date)
);
CREATE INDEX ix_staffing_day_entries_week ON staffing_member_day_entries(organization_id, work_date);
