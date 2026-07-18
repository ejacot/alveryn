DO $$
BEGIN
    IF to_regclass('work_types') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'work_types'
             AND column_name = 'composite_enabled'
       )
       AND EXISTS (
           SELECT 1
           FROM flyway_schema_history
           WHERE version = '28' AND success
       )
       AND NOT EXISTS (
           SELECT 1
           FROM flyway_schema_history
           WHERE version = '29' AND success
       ) THEN
        UPDATE work_types
        SET unit_label = NULL,
            unit_symbol = NULL,
            units_per_hour = NULL,
            rate_per_unit = NULL,
            currency = NULL
        WHERE composite_enabled;
    END IF;
END $$;
