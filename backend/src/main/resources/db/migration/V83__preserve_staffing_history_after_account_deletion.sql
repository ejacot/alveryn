ALTER TABLE staffing_requirements DROP CONSTRAINT staffing_requirements_created_by_membership_id_fkey;
ALTER TABLE staffing_requirements ALTER COLUMN created_by_membership_id DROP NOT NULL;
ALTER TABLE staffing_requirements ADD CONSTRAINT staffing_requirements_created_by_membership_id_fkey
    FOREIGN KEY (created_by_membership_id) REFERENCES organization_memberships(id) ON DELETE SET NULL;

ALTER TABLE staffing_assignments DROP CONSTRAINT staffing_assignments_assigned_by_membership_id_fkey;
ALTER TABLE staffing_assignments ALTER COLUMN assigned_by_membership_id DROP NOT NULL;
ALTER TABLE staffing_assignments ADD CONSTRAINT staffing_assignments_assigned_by_membership_id_fkey
    FOREIGN KEY (assigned_by_membership_id) REFERENCES organization_memberships(id) ON DELETE SET NULL;
