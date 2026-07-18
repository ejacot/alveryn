ALTER TABLE work_types
    ADD COLUMN IF NOT EXISTS parent_work_type_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_types_parent') THEN
        ALTER TABLE work_types
            ADD CONSTRAINT fk_work_types_parent
            FOREIGN KEY (parent_work_type_id) REFERENCES work_types (id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_work_types_user_name') THEN
        ALTER TABLE work_types DROP CONSTRAINT uk_work_types_user_name;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_work_types_user_root_name
    ON work_types (user_id, normalized_name)
    WHERE parent_work_type_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_work_types_user_parent_name
    ON work_types (user_id, parent_work_type_id, normalized_name)
    WHERE parent_work_type_id IS NOT NULL;

INSERT INTO work_types (
    id,
    user_id,
    parent_work_type_id,
    name,
    normalized_name,
    calculation_method,
    compensation_method,
    unit_label,
    unit_symbol,
    units_per_hour,
    rate_per_unit,
    currency,
    teamwork_enabled,
    composite_enabled,
    color,
    icon,
    default_break_minutes,
    active,
    display_order,
    created_at,
    updated_at
)
SELECT
    cfg.id,
    wt.user_id,
    wt.id,
    cfg.name,
    cfg.normalized_name,
    CASE
        WHEN cfg.calculation_mode = 'TIME_HOURLY' THEN 'TIME_BASED'
        WHEN cfg.calculation_mode = 'UNITS_PER_HOUR' THEN 'UNITS_PER_HOUR_BASED'
        ELSE 'UNIT_BASED'
    END,
    CASE WHEN cfg.calculation_mode = 'UNITS_PER_UNIT' THEN 'PER_UNIT' ELSE 'HOURLY' END,
    cfg.unit_label,
    cfg.unit_symbol,
    cfg.units_per_hour,
    cfg.rate_per_unit,
    cfg.currency,
    wt.teamwork_enabled,
    FALSE,
    wt.color,
    wt.icon,
    cfg.default_break_minutes,
    cfg.active,
    cfg.display_order,
    cfg.created_at,
    cfg.updated_at
FROM work_type_configurations cfg
JOIN work_types wt ON wt.id = cfg.work_type_id
WHERE NOT EXISTS (
    SELECT 1 FROM work_types child WHERE child.id = cfg.id
)
AND NOT EXISTS (
    SELECT 1
    FROM work_types sibling
    WHERE sibling.user_id = wt.user_id
      AND sibling.parent_work_type_id = wt.id
      AND sibling.normalized_name = cfg.normalized_name
);

UPDATE work_types parent
SET composite_enabled = TRUE
WHERE EXISTS (
    SELECT 1 FROM work_types child WHERE child.parent_work_type_id = parent.id
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_configuration') THEN
        ALTER TABLE work_record_lines DROP CONSTRAINT fk_work_record_lines_configuration;
    END IF;
END $$;

ALTER TABLE work_record_lines
    ALTER COLUMN work_type_configuration_id DROP NOT NULL;

UPDATE work_record_lines line
SET work_type_id = line.work_type_configuration_id
WHERE line.work_type_configuration_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM work_types child WHERE child.id = line.work_type_configuration_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_configuration') THEN
        ALTER TABLE work_record_lines
            ADD CONSTRAINT fk_work_record_lines_configuration
            FOREIGN KEY (work_type_configuration_id) REFERENCES work_type_configurations (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_types_parent
    ON work_types (parent_work_type_id, active, display_order);
