CREATE TABLE IF NOT EXISTS work_type_configurations (
    id UUID PRIMARY KEY,
    work_type_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    calculation_mode VARCHAR(40) NOT NULL,
    unit_label VARCHAR(100),
    unit_symbol VARCHAR(20),
    units_per_hour NUMERIC(12, 4),
    rate_per_unit NUMERIC(12, 4),
    currency VARCHAR(3),
    default_break_minutes INTEGER,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    legacy_unit_type_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_type_configurations_work_type') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT fk_work_type_configurations_work_type
            FOREIGN KEY (work_type_id) REFERENCES work_types (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_type_configurations_legacy_unit_type') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT fk_work_type_configurations_legacy_unit_type
            FOREIGN KEY (legacy_unit_type_id) REFERENCES unit_types (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_work_type_configurations_work_type_name') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT uk_work_type_configurations_work_type_name UNIQUE (work_type_id, normalized_name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_type_configurations_mode') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT ck_work_type_configurations_mode
            CHECK (calculation_mode IN ('TIME_HOURLY', 'UNITS_PER_HOUR', 'UNITS_PER_UNIT'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_type_configurations_valid_fields') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT ck_work_type_configurations_valid_fields
            CHECK (
                (
                    calculation_mode = 'TIME_HOURLY'
                    AND units_per_hour IS NULL
                    AND rate_per_unit IS NULL
                    AND currency IS NULL
                )
                OR (
                    calculation_mode = 'UNITS_PER_HOUR'
                    AND unit_label IS NOT NULL
                    AND units_per_hour IS NOT NULL
                    AND units_per_hour > 0
                    AND rate_per_unit IS NULL
                    AND currency IS NULL
                )
                OR (
                    calculation_mode = 'UNITS_PER_UNIT'
                    AND unit_label IS NOT NULL
                    AND rate_per_unit IS NOT NULL
                    AND rate_per_unit > 0
                    AND currency ~ '^[A-Z]{3}$'
                    AND (units_per_hour IS NULL OR units_per_hour > 0)
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_type_configurations_display_order') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT ck_work_type_configurations_display_order CHECK (display_order >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_type_configurations_default_break') THEN
        ALTER TABLE work_type_configurations
            ADD CONSTRAINT ck_work_type_configurations_default_break CHECK (default_break_minutes IS NULL OR default_break_minutes >= 0);
    END IF;
END $$;

INSERT INTO work_type_configurations (
    id,
    work_type_id,
    name,
    normalized_name,
    calculation_mode,
    default_break_minutes,
    active,
    display_order,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    wt.id,
    wt.name,
    wt.normalized_name,
    'TIME_HOURLY',
    wt.default_break_minutes,
    wt.active,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM work_types wt
WHERE wt.calculation_method = 'TIME_BASED'
  AND NOT EXISTS (
      SELECT 1
      FROM work_type_configurations cfg
      WHERE cfg.work_type_id = wt.id
        AND cfg.normalized_name = wt.normalized_name
  );

INSERT INTO work_type_configurations (
    id,
    work_type_id,
    name,
    normalized_name,
    calculation_mode,
    unit_label,
    unit_symbol,
    units_per_hour,
    rate_per_unit,
    currency,
    active,
    display_order,
    legacy_unit_type_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    wt.id,
    ut.name,
    ut.normalized_name,
    CASE WHEN wt.compensation_method = 'PER_UNIT' THEN 'UNITS_PER_UNIT' ELSE 'UNITS_PER_HOUR' END,
    ut.name,
    ut.symbol,
    ut.units_per_hour,
    ut.rate_per_unit,
    ut.currency,
    ut.active,
    ut.display_order,
    ut.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM unit_types ut
JOIN work_types wt ON wt.id = ut.work_type_id
WHERE NOT EXISTS (
    SELECT 1
    FROM work_type_configurations cfg
    WHERE cfg.legacy_unit_type_id = ut.id
);

CREATE TABLE IF NOT EXISTS work_record_lines (
    id UUID PRIMARY KEY,
    work_record_id UUID NOT NULL,
    work_type_id UUID NOT NULL,
    work_type_configuration_id UUID NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    work_type_name_snapshot VARCHAR(100) NOT NULL,
    configuration_name_snapshot VARCHAR(120) NOT NULL,
    calculation_mode_snapshot VARCHAR(40) NOT NULL,
    unit_label_snapshot VARCHAR(100),
    unit_symbol_snapshot VARCHAR(20),
    quantity NUMERIC(18, 4),
    units_per_hour_snapshot NUMERIC(12, 4),
    start_time TIME,
    end_time TIME,
    break_minutes INTEGER,
    calculated_minutes NUMERIC(30, 15) NOT NULL,
    hourly_rate_snapshot NUMERIC(10, 2),
    rate_per_unit_snapshot NUMERIC(12, 4),
    currency_snapshot VARCHAR(3) NOT NULL,
    gross_amount NUMERIC(30, 15) NOT NULL,
    extra_pay_percentage INTEGER NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_record') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT fk_work_record_lines_record
            FOREIGN KEY (work_record_id) REFERENCES work_records (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_work_type') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT fk_work_record_lines_work_type
            FOREIGN KEY (work_type_id) REFERENCES work_types (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_configuration') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT fk_work_record_lines_configuration
            FOREIGN KEY (work_type_configuration_id) REFERENCES work_type_configurations (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_mode') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT ck_work_record_lines_mode
            CHECK (calculation_mode_snapshot IN ('TIME_HOURLY', 'UNITS_PER_HOUR', 'UNITS_PER_UNIT'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_valid_fields') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT ck_work_record_lines_valid_fields
            CHECK (
                (
                    calculation_mode_snapshot = 'TIME_HOURLY'
                    AND start_time IS NOT NULL
                    AND end_time IS NOT NULL
                    AND break_minutes IS NOT NULL
                    AND break_minutes >= 0
                    AND calculated_minutes > 0
                    AND hourly_rate_snapshot IS NOT NULL
                    AND hourly_rate_snapshot >= 0
                    AND quantity IS NULL
                    AND rate_per_unit_snapshot IS NULL
                )
                OR (
                    calculation_mode_snapshot = 'UNITS_PER_HOUR'
                    AND quantity IS NOT NULL
                    AND quantity > 0
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
                    AND calculated_minutes >= 0
                    AND rate_per_unit_snapshot IS NOT NULL
                    AND rate_per_unit_snapshot > 0
                    AND hourly_rate_snapshot IS NULL
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_currency') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT ck_work_record_lines_currency CHECK (currency_snapshot ~ '^[A-Z]{3}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_work_record_lines_gross') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT ck_work_record_lines_gross CHECK (gross_amount >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_type_configurations_work_type
    ON work_type_configurations (work_type_id, active, display_order);
CREATE INDEX IF NOT EXISTS idx_work_type_configurations_legacy_unit_type
    ON work_type_configurations (legacy_unit_type_id);
CREATE INDEX IF NOT EXISTS idx_work_record_lines_record
    ON work_record_lines (work_record_id, display_order);
CREATE INDEX IF NOT EXISTS idx_work_record_lines_configuration
    ON work_record_lines (work_type_configuration_id);
