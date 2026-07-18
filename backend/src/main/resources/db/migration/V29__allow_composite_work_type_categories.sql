DO $$
BEGIN
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
END $$;

ALTER TABLE work_types
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
                calculation_method = 'TIME_BASED'
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
