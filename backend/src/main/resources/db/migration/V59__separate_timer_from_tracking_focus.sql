ALTER TABLE employments
    ADD COLUMN timer_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE employments
SET timer_enabled = tracking_focus = 'TIME';
