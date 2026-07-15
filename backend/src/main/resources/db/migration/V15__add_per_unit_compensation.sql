ALTER TABLE work_types
    ADD COLUMN compensation_method VARCHAR(30) NOT NULL DEFAULT 'HOURLY';

ALTER TABLE work_types
    ADD CONSTRAINT ck_work_types_compensation_method
        CHECK (compensation_method IN ('HOURLY', 'PER_UNIT')),
    ADD CONSTRAINT ck_work_types_tracking_compensation
        CHECK (calculation_method = 'UNIT_BASED' OR compensation_method = 'HOURLY');

ALTER TABLE unit_types
    ALTER COLUMN units_per_hour DROP NOT NULL,
    ADD COLUMN symbol VARCHAR(20),
    ADD COLUMN rate_per_unit NUMERIC(12, 4),
    ADD COLUMN currency VARCHAR(3);

ALTER TABLE unit_types
    DROP CONSTRAINT ck_unit_types_units_per_hour,
    ADD CONSTRAINT ck_unit_types_units_per_hour
        CHECK (units_per_hour IS NULL OR units_per_hour > 0),
    ADD CONSTRAINT ck_unit_types_rate_per_unit
        CHECK (rate_per_unit IS NULL OR rate_per_unit > 0),
    ADD CONSTRAINT ck_unit_types_currency
        CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT ck_unit_types_rate_currency_pair
        CHECK (
            (rate_per_unit IS NULL AND currency IS NULL)
            OR (rate_per_unit IS NOT NULL AND currency IS NOT NULL)
        );

ALTER TABLE work_entries
    ADD COLUMN compensation_method_snapshot VARCHAR(30) NOT NULL DEFAULT 'HOURLY';

ALTER TABLE work_entries
    DROP CONSTRAINT ck_work_entries_calculated_minutes,
    DROP CONSTRAINT ck_work_entries_gross_calculation;

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_compensation_method
        CHECK (compensation_method_snapshot IN ('HOURLY', 'PER_UNIT')),
    ADD CONSTRAINT ck_work_entries_calculated_minutes
        CHECK (
            (compensation_method_snapshot = 'HOURLY' AND calculated_minutes > 0)
            OR (compensation_method_snapshot = 'PER_UNIT' AND calculated_minutes >= 0)
        ),
    ADD CONSTRAINT ck_work_entries_tracking_compensation
        CHECK (
            calculation_method_snapshot = 'UNIT_BASED'
            OR compensation_method_snapshot = 'HOURLY'
        ),
    ADD CONSTRAINT ck_work_entries_gross_calculation
        CHECK (
            compensation_method_snapshot = 'PER_UNIT'
            OR gross_amount = ROUND(
                hourly_rate_snapshot * calculated_minutes / 60 * (100 + extra_pay_percentage) / 100,
                15
            )
        );

ALTER TABLE unit_entry_items
    ADD COLUMN unit_symbol_snapshot VARCHAR(20),
    ADD COLUMN rate_per_unit_snapshot NUMERIC(12, 4),
    ADD COLUMN currency_snapshot VARCHAR(3),
    ADD COLUMN gross_amount_snapshot NUMERIC(30, 15);

ALTER TABLE unit_entry_items
    DROP CONSTRAINT ck_unit_entry_items_units_per_hour,
    DROP CONSTRAINT ck_unit_entry_items_minutes,
    DROP CONSTRAINT ck_unit_entry_items_minutes_calculation;

ALTER TABLE unit_entry_items
    ADD CONSTRAINT ck_unit_entry_items_units_per_hour
        CHECK (units_per_hour_snapshot IS NULL OR units_per_hour_snapshot > 0),
    ADD CONSTRAINT ck_unit_entry_items_rate_per_unit
        CHECK (rate_per_unit_snapshot IS NULL OR rate_per_unit_snapshot > 0),
    ADD CONSTRAINT ck_unit_entry_items_currency
        CHECK (currency_snapshot IS NULL OR currency_snapshot ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT ck_unit_entry_items_gross
        CHECK (gross_amount_snapshot IS NULL OR gross_amount_snapshot >= 0),
    ADD CONSTRAINT ck_unit_entry_items_minutes
        CHECK (calculated_minutes >= 0),
    ADD CONSTRAINT ck_unit_entry_items_minutes_calculation
        CHECK (
            (units_per_hour_snapshot IS NULL AND calculated_minutes = 0)
            OR calculated_minutes = ROUND(quantity * 60 / units_per_hour_snapshot, 15)
        ),
    ADD CONSTRAINT ck_unit_entry_items_unit_rate_pair
        CHECK (
            (rate_per_unit_snapshot IS NULL AND currency_snapshot IS NULL AND gross_amount_snapshot IS NULL)
            OR (
                rate_per_unit_snapshot IS NOT NULL
                AND currency_snapshot IS NOT NULL
                AND gross_amount_snapshot IS NOT NULL
                AND gross_amount_snapshot = ROUND(quantity * rate_per_unit_snapshot, 15)
            )
        );
