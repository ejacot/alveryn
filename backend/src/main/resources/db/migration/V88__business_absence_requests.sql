CREATE TABLE staffing_absence_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
  absence_type VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes VARCHAR(1000),
  request_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_staffing_absence_type CHECK (absence_type IN ('REST_DAY','VACATION','SICK')),
  CONSTRAINT ck_staffing_absence_dates CHECK (end_date >= start_date),
  CONSTRAINT ck_staffing_absence_status CHECK (request_status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE INDEX ix_staffing_absence_pending ON staffing_absence_requests(organization_id, request_status, created_at);
