ALTER TABLE work_record_lines
    ADD COLUMN IF NOT EXISTS fixed_amount_snapshot NUMERIC(30, 15);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_work_types_calculation_method'
          AND conrelid = 'work_types'::regclass
    ) THEN
        ALTER TABLE work_types DROP CONSTRAINT ck_work_types_calculation_method;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_work_types_tracking_compensation'
          AND conrelid = 'work_types'::regclass
    ) THEN
        ALTER TABLE work_types DROP CONSTRAINT ck_work_types_tracking_compensation;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_work_types_formula_fields'
          AND conrelid = 'work_types'::regclass
    ) THEN
        ALTER TABLE work_types DROP CONSTRAINT ck_work_types_formula_fields;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_work_record_lines_mode'
          AND conrelid = 'work_record_lines'::regclass
    ) THEN
        ALTER TABLE work_record_lines DROP CONSTRAINT ck_work_record_lines_mode;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_work_record_lines_valid_fields_v2'
          AND conrelid = 'work_record_lines'::regclass
    ) THEN
        ALTER TABLE work_record_lines DROP CONSTRAINT ck_work_record_lines_valid_fields_v2;
    END IF;
END $$;

ALTER TABLE work_types
    ADD CONSTRAINT ck_work_types_calculation_method
        CHECK (calculation_method IN ('TIME_BASED', 'UNIT_BASED', 'UNITS_PER_HOUR_BASED', 'FIXED_PRICE_BASED')),
    ADD CONSTRAINT ck_work_types_tracking_compensation
        CHECK (
            (
                composite_enabled
                AND unit_label IS NULL
                AND unit_symbol IS NULL
                AND units_per_hour IS NULL
                AND rate_per_unit IS NULL
                AND currency IS NULL
            )
            OR (calculation_method = 'UNIT_BASED' AND compensation_method = 'PER_UNIT')
            OR (calculation_method <> 'UNIT_BASED' AND compensation_method = 'HOURLY')
        ),
    ADD CONSTRAINT ck_work_types_formula_fields
        CHECK (
            (
                composite_enabled
                AND unit_label IS NULL
                AND unit_symbol IS NULL
                AND units_per_hour IS NULL
                AND rate_per_unit IS NULL
                AND currency IS NULL
            )
            OR (
                calculation_method IN ('TIME_BASED', 'FIXED_PRICE_BASED')
                AND unit_label IS NULL
                AND unit_symbol IS NULL
                AND units_per_hour IS NULL
                AND rate_per_unit IS NULL
                AND currency IS NULL
            )
            OR (
                calculation_method = 'UNITS_PER_HOUR_BASED'
                AND unit_label IS NOT NULL
                AND units_per_hour > 0
                AND rate_per_unit IS NULL
                AND currency IS NULL
            )
            OR (
                calculation_method = 'UNIT_BASED'
                AND unit_label IS NOT NULL
                AND rate_per_unit > 0
                AND currency ~ '^[A-Z]{3}$'
                AND (units_per_hour IS NULL OR units_per_hour > 0)
            )
        );

ALTER TABLE work_record_lines
    ADD CONSTRAINT ck_work_record_lines_mode
        CHECK (calculation_mode_snapshot IN ('TIME_HOURLY', 'UNITS_PER_HOUR', 'UNITS_PER_UNIT', 'FIXED_AMOUNT')),
    ADD CONSTRAINT ck_work_record_lines_valid_fields_v2
        CHECK (
            (
                calculation_mode_snapshot = 'TIME_HOURLY'
                AND calculated_minutes > 0
                AND hourly_rate_snapshot IS NOT NULL
                AND hourly_rate_snapshot >= 0
                AND quantity IS NULL
                AND fixed_amount_snapshot IS NULL
                AND rate_per_unit_snapshot IS NULL
                AND (
                    (
                        start_time IS NOT NULL
                        AND end_time IS NOT NULL
                        AND break_minutes IS NOT NULL
                        AND break_minutes >= 0
                        AND duration_minutes IS NULL
                    )
                    OR (
                        start_time IS NULL
                        AND end_time IS NULL
                        AND break_minutes IS NULL
                        AND duration_minutes IS NOT NULL
                        AND duration_minutes > 0
                    )
                )
            )
            OR (
                calculation_mode_snapshot = 'UNITS_PER_HOUR'
                AND quantity IS NOT NULL
                AND quantity > 0
                AND fixed_amount_snapshot IS NULL
                AND units_per_hour_snapshot IS NOT NULL
                AND units_per_hour_snapshot > 0
                AND calculated_minutes > 0
                AND hourly_rate_snapshot IS NOT NULL
                AND hourly_rate_snapshot >= 0
                AND rate_per_unit_snapshot IS NULL
            )
            OR (
                calculation_mode_snapshot = 'UNITS_PER_UNIT'
                AND quantity IS NOT NULL
                AND quantity > 0
                AND fixed_amount_snapshot IS NULL
                AND calculated_minutes >= 0
                AND rate_per_unit_snapshot IS NOT NULL
                AND rate_per_unit_snapshot > 0
                AND hourly_rate_snapshot IS NULL
            )
            OR (
                calculation_mode_snapshot = 'FIXED_AMOUNT'
                AND quantity IS NULL
                AND fixed_amount_snapshot IS NOT NULL
                AND fixed_amount_snapshot > 0
                AND calculated_minutes = 0
                AND hourly_rate_snapshot IS NULL
                AND rate_per_unit_snapshot IS NULL
                AND units_per_hour_snapshot IS NULL
                AND start_time IS NULL
                AND end_time IS NULL
                AND break_minutes IS NULL
                AND duration_minutes IS NULL
                AND gross_amount = fixed_amount_snapshot
            )
        );
