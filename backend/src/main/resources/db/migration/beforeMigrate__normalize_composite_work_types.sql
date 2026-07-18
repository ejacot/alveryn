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
        WHERE composite_enabled OR calculation_method = 'TIME_BASED';

        UPDATE work_types
        SET composite_enabled = TRUE,
            unit_label = NULL,
            unit_symbol = NULL,
            units_per_hour = NULL,
            rate_per_unit = NULL,
            currency = NULL
        WHERE calculation_method = 'UNITS_PER_HOUR_BASED'
          AND (
              unit_label IS NULL
              OR units_per_hour IS NULL
              OR units_per_hour <= 0
              OR rate_per_unit IS NOT NULL
              OR currency IS NOT NULL
          );

        UPDATE work_types
        SET composite_enabled = TRUE,
            unit_label = NULL,
            unit_symbol = NULL,
            units_per_hour = NULL,
            rate_per_unit = NULL,
            currency = NULL
        WHERE calculation_method = 'UNIT_BASED'
          AND (
              unit_label IS NULL
              OR rate_per_unit IS NULL
              OR rate_per_unit <= 0
              OR currency IS NULL
              OR currency !~ '^[A-Z]{3}$'
              OR units_per_hour <= 0
          );
    END IF;
END $$;
