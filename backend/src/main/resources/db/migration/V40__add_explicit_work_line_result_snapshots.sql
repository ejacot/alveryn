ALTER TABLE work_record_lines
    ADD COLUMN worked_minutes NUMERIC(30, 15) NOT NULL DEFAULT 0,
    ADD COLUMN extra_paid_equivalent_minutes NUMERIC(30, 15) NOT NULL DEFAULT 0,
    ADD COLUMN total_paid_equivalent_minutes NUMERIC(30, 15) NOT NULL DEFAULT 0,
    ADD COLUMN base_gross_amount NUMERIC(30, 15) NOT NULL DEFAULT 0,
    ADD COLUMN extra_gross_amount NUMERIC(30, 15) NOT NULL DEFAULT 0,
    ADD COLUMN total_gross_amount NUMERIC(30, 15) NOT NULL DEFAULT 0;

UPDATE work_record_lines
SET worked_minutes = CASE
        WHEN calculation_mode_snapshot IN ('TIME_HOURLY', 'UNITS_PER_HOUR') THEN calculated_minutes
        ELSE 0
    END,
    extra_paid_equivalent_minutes = CASE
        WHEN calculation_mode_snapshot IN ('TIME_HOURLY', 'UNITS_PER_HOUR')
            THEN calculated_minutes * extra_pay_percentage / 100
        ELSE 0
    END,
    base_gross_amount = gross_amount * 100 / (100 + extra_pay_percentage),
    extra_gross_amount = gross_amount - (gross_amount * 100 / (100 + extra_pay_percentage)),
    total_gross_amount = gross_amount;

-- Build totals from the stored components after PostgreSQL has applied the column scale.
UPDATE work_record_lines
SET total_paid_equivalent_minutes = worked_minutes + extra_paid_equivalent_minutes,
    total_gross_amount = base_gross_amount + extra_gross_amount,
    gross_amount = base_gross_amount + extra_gross_amount;

ALTER TABLE work_record_lines
    ADD CONSTRAINT ck_work_record_lines_result_snapshots
        CHECK (
            worked_minutes >= 0
            AND extra_paid_equivalent_minutes >= 0
            AND total_paid_equivalent_minutes = worked_minutes + extra_paid_equivalent_minutes
            AND base_gross_amount >= 0
            AND extra_gross_amount >= 0
            AND total_gross_amount = base_gross_amount + extra_gross_amount
            AND gross_amount = total_gross_amount
        );
