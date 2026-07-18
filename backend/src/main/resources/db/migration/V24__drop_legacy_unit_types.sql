ALTER TABLE work_type_configurations
    DROP CONSTRAINT IF EXISTS fk_work_type_configurations_legacy_unit_type;

DROP INDEX IF EXISTS idx_work_type_configurations_legacy_unit_type;

ALTER TABLE work_type_configurations
    DROP COLUMN IF EXISTS legacy_unit_type_id;

DROP TABLE IF EXISTS unit_entry_items;
DROP TABLE IF EXISTS unit_types;
