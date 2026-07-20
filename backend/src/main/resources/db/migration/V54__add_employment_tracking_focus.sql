ALTER TABLE employments
    ADD COLUMN tracking_focus VARCHAR(20),
    ADD COLUMN hour_balance_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE employments
SET tracking_focus = CASE
    WHEN compensation_type = 'FIXED_SALARY' THEN 'TIME'
    ELSE 'EARNINGS'
END,
hour_balance_enabled = compensation_type = 'FIXED_SALARY';

ALTER TABLE employments
    ALTER COLUMN tracking_focus SET NOT NULL;
