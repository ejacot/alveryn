ALTER TABLE work_types
    ADD COLUMN extra_pay_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the behavior that was already available for hourly-derived work.
UPDATE work_types
SET extra_pay_enabled = TRUE
WHERE calculation_method IN ('TIME_BASED', 'UNITS_PER_HOUR_BASED');
