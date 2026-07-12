ALTER TABLE work_entries
    DROP CONSTRAINT ck_work_entries_gross_calculation;

ALTER TABLE work_entries
    ALTER COLUMN gross_amount TYPE NUMERIC(30, 15)
        USING gross_amount::NUMERIC(30, 15),
    ADD CONSTRAINT ck_work_entries_gross_calculation
        CHECK (gross_amount = ROUND(hourly_rate_snapshot * calculated_minutes / 60, 15));
