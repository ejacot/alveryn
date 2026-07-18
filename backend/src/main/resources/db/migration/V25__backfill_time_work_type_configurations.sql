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
  );
