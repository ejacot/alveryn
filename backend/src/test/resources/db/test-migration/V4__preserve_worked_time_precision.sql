ALTER TABLE work_entries
    DROP CONSTRAINT ck_work_entries_gross_calculation;

ALTER TABLE work_entries
    DROP CONSTRAINT ck_work_entries_calculated_minutes;

ALTER TABLE work_entries
    ALTER COLUMN calculated_minutes TYPE NUMERIC(30, 15)
        USING calculated_minutes::NUMERIC(30, 15);

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_calculated_minutes
        CHECK (calculated_minutes > 0);

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_gross_calculation
        CHECK (gross_amount = ROUND(hourly_rate_snapshot * calculated_minutes / 60, 2));

ALTER TABLE unit_entry_items
    DROP CONSTRAINT ck_unit_entry_items_minutes_calculation;

ALTER TABLE unit_entry_items
    DROP CONSTRAINT ck_unit_entry_items_minutes;

ALTER TABLE unit_entry_items
    ALTER COLUMN calculated_minutes TYPE NUMERIC(30, 15)
        USING calculated_minutes::NUMERIC(30, 15);

ALTER TABLE unit_entry_items
    ADD CONSTRAINT ck_unit_entry_items_minutes
        CHECK (calculated_minutes > 0);

ALTER TABLE unit_entry_items
    ADD CONSTRAINT ck_unit_entry_items_minutes_calculation
        CHECK (calculated_minutes = ROUND(quantity * 60 / units_per_hour_snapshot, 15));
