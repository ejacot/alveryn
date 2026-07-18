DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_record_lines_configuration') THEN
        ALTER TABLE work_record_lines DROP CONSTRAINT fk_work_record_lines_configuration;
    END IF;
END $$;

UPDATE work_record_lines line
SET work_type_id = line.work_type_configuration_id
WHERE line.work_type_configuration_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM work_types child WHERE child.id = line.work_type_configuration_id);

DROP INDEX IF EXISTS idx_work_record_lines_configuration;

ALTER TABLE work_record_lines
    DROP COLUMN IF EXISTS work_type_configuration_id;

DROP INDEX IF EXISTS idx_work_type_configurations_work_type;
DROP INDEX IF EXISTS idx_work_type_configurations_legacy_unit_type;

DROP TABLE IF EXISTS work_type_configurations;
