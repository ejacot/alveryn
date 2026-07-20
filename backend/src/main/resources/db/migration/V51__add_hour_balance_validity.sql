ALTER TABLE employments
    ADD COLUMN hour_balance_validity_months INTEGER NULL;

UPDATE employments
SET hour_balance_validity_months = 12
WHERE compensation_type = 'FIXED_SALARY';

ALTER TABLE employments
    ADD CONSTRAINT chk_employments_hour_balance_validity
        CHECK (hour_balance_validity_months IS NULL OR hour_balance_validity_months > 0);
