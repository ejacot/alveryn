ALTER TABLE organization_work_types
  ADD COLUMN parent_work_type_id UUID REFERENCES organization_work_types(id) ON DELETE SET NULL,
  ADD COLUMN calculation_method VARCHAR(30) NOT NULL DEFAULT 'TIME_BASED',
  ADD COLUMN compensation_method VARCHAR(30) NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN unit_label VARCHAR(100),
  ADD COLUMN unit_symbol VARCHAR(20),
  ADD COLUMN units_per_hour NUMERIC(12,4),
  ADD COLUMN rate_per_unit NUMERIC(12,4),
  ADD COLUMN currency VARCHAR(3),
  ADD COLUMN teamwork_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN extra_pay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN composite_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE organization_work_types
  ADD CONSTRAINT ck_org_work_type_calculation CHECK (calculation_method IN ('TIME_BASED','UNIT_BASED','UNITS_PER_HOUR_BASED','FIXED_PRICE_BASED')),
  ADD CONSTRAINT ck_org_work_type_compensation CHECK (compensation_method IN ('HOURLY','PER_UNIT')),
  ADD CONSTRAINT ck_org_work_type_parent CHECK (parent_work_type_id IS NULL OR parent_work_type_id <> id);
