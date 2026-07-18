ALTER TABLE work_types
    ADD COLUMN IF NOT EXISTS unit_label VARCHAR(100),
    ADD COLUMN IF NOT EXISTS unit_symbol VARCHAR(20),
    ADD COLUMN IF NOT EXISTS units_per_hour NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS teamwork_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS composite_enabled BOOLEAN NOT NULL DEFAULT FALSE;

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
END $$;

UPDATE work_types wt
SET
    calculation_method = 'UNITS_PER_HOUR_BASED'
WHERE wt.calculation_method = 'UNIT_BASED'
  AND wt.compensation_method = 'HOURLY';

UPDATE work_types wt
SET
    unit_label = cfg.unit_label,
    unit_symbol = cfg.unit_symbol,
    units_per_hour = cfg.units_per_hour,
    rate_per_unit = cfg.rate_per_unit,
    currency = cfg.currency
FROM work_type_configurations cfg
WHERE cfg.work_type_id = wt.id
  AND cfg.display_order = 0
  AND (
      wt.unit_label IS NULL
      OR wt.units_per_hour IS NULL
      OR wt.rate_per_unit IS NULL
      OR wt.currency IS NULL
  );

DO $$
BEGIN
    ALTER TABLE work_types
        ADD CONSTRAINT ck_work_types_calculation_method
            CHECK (calculation_method IN ('TIME_BASED', 'UNIT_BASED', 'UNITS_PER_HOUR_BASED')),
        ADD CONSTRAINT ck_work_types_tracking_compensation
            CHECK (
                (calculation_method = 'UNIT_BASED' AND compensation_method = 'PER_UNIT')
                OR (calculation_method <> 'UNIT_BASED' AND compensation_method = 'HOURLY')
            ),
        ADD CONSTRAINT ck_work_types_formula_fields
            CHECK (
                (
                    calculation_method = 'TIME_BASED'
                    AND unit_label IS NULL
                    AND unit_symbol IS NULL
                    AND units_per_hour IS NULL
                    AND rate_per_unit IS NULL
                    AND currency IS NULL
                )
                OR (
                    calculation_method = 'UNITS_PER_HOUR_BASED'
                    AND (units_per_hour IS NULL OR units_per_hour > 0)
                    AND rate_per_unit IS NULL
                    AND currency IS NULL
                )
                OR (
                    calculation_method = 'UNIT_BASED'
                    AND (rate_per_unit IS NULL OR rate_per_unit > 0)
                    AND (currency IS NULL OR currency ~ '^[A-Z]{3}$')
                    AND (units_per_hour IS NULL OR units_per_hour > 0)
                    AND (
                        (rate_per_unit IS NULL AND currency IS NULL)
                        OR (rate_per_unit IS NOT NULL AND currency IS NOT NULL)
                    )
                )
            );
END $$;

CREATE INDEX IF NOT EXISTS idx_work_types_user_formula
    ON work_types (user_id, calculation_method, active);
