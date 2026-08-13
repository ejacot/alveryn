ALTER TABLE staffing_assignment_results
    ADD COLUMN checked_in_at TIMESTAMPTZ,
    ADD COLUMN checked_out_at TIMESTAMPTZ,
    ADD COLUMN time_capture_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE staffing_assignment_results
    ADD CONSTRAINT ck_staffing_result_checkout CHECK (checked_out_at IS NULL OR checked_in_at IS NOT NULL),
    ADD CONSTRAINT ck_staffing_result_capture_source CHECK (time_capture_source IN ('MANUAL', 'CHECK_IN'));
