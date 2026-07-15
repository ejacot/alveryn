ALTER TABLE work_entries
    ADD COLUMN extra_pay_percentage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_extra_pay_percentage
        CHECK (extra_pay_percentage >= 0 AND extra_pay_percentage <= 1000);

ALTER TABLE work_entries
    DROP CONSTRAINT ck_work_entries_gross_calculation;

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_gross_calculation
        CHECK (
            gross_amount = ROUND(
                hourly_rate_snapshot * calculated_minutes / 60 * (100 + extra_pay_percentage) / 100,
                15
            )
        );
