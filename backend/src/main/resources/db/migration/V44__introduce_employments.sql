-- Employment aggregate and backward-compatible data promotion.
CREATE TABLE employments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    employment_type VARCHAR(30) NOT NULL,
    compensation_type VARCHAR(30) NOT NULL,
    start_date DATE,
    end_date DATE,
    fixed_salary_amount NUMERIC(14,4),
    currency VARCHAR(3),
    target_minutes INTEGER,
    target_period VARCHAR(20),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_employments_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_employments_compensation CHECK (compensation_type IN ('FIXED_SALARY','HOURLY','PER_UNIT','FIXED_AMOUNT')),
    CONSTRAINT ck_employments_type CHECK (employment_type IN ('FULL_TIME','PART_TIME','MINI_JOB','FREELANCE','CONTRACTOR','OTHER')),
    CONSTRAINT ck_employments_target_period CHECK (target_period IS NULL OR target_period IN ('WEEKLY','MONTHLY')),
    CONSTRAINT ck_employments_fixed_target CHECK (compensation_type <> 'FIXED_SALARY' OR (target_minutes > 0 AND target_period IS NOT NULL))
);

CREATE INDEX ix_employments_user ON employments(user_id, active, display_order);

INSERT INTO employments (id, user_id, name, employment_type, compensation_type, start_date, end_date,
                         target_minutes, target_period, active, display_order)
SELECT gen_random_uuid(), u.id, 'Primary employment', COALESCE(p.employment_type, 'FULL_TIME'),
       'HOURLY', p.employment_start_date, p.employment_end_date, NULL, NULL, TRUE, 0
FROM user_accounts u
LEFT JOIN user_profiles p ON p.user_id = u.id;

-- Normalize installations that briefly received the former fixed-salary Work Type experiment.
UPDATE employments e SET compensation_type = 'FIXED_SALARY', target_minutes = 9600, target_period = 'MONTHLY'
WHERE EXISTS (SELECT 1 FROM work_types wt WHERE wt.user_id = e.user_id AND wt.calculation_method = 'TIME_TRACKING_BASED');
UPDATE work_types SET calculation_method = 'TIME_BASED' WHERE calculation_method = 'TIME_TRACKING_BASED';

ALTER TABLE work_types ADD COLUMN employment_id UUID;
UPDATE work_types wt SET employment_id = e.id
FROM employments e WHERE e.user_id = wt.user_id AND e.display_order = 0;
ALTER TABLE work_types ADD CONSTRAINT fk_work_types_employment FOREIGN KEY (employment_id) REFERENCES employments(id);
CREATE INDEX ix_work_types_employment ON work_types(employment_id);

ALTER TABLE work_records ADD COLUMN employment_id UUID;
UPDATE work_records wr SET employment_id = e.id
FROM employments e WHERE e.user_id = wr.user_id AND e.display_order = 0;
ALTER TABLE work_records ADD CONSTRAINT fk_work_records_employment FOREIGN KEY (employment_id) REFERENCES employments(id);
CREATE INDEX ix_work_records_employment_date ON work_records(employment_id, work_date);

ALTER TABLE work_record_lines ALTER COLUMN currency_snapshot DROP NOT NULL;
ALTER TABLE work_record_lines DROP CONSTRAINT IF EXISTS ck_work_record_lines_calculation_mode;
ALTER TABLE work_record_lines DROP CONSTRAINT IF EXISTS ck_work_record_lines_calculation_mode_snapshot;
ALTER TABLE work_record_lines DROP CONSTRAINT IF EXISTS ck_work_record_lines_mode;
ALTER TABLE work_record_lines DROP CONSTRAINT IF EXISTS ck_work_record_lines_valid_fields_v2;
ALTER TABLE work_record_lines ADD CONSTRAINT ck_work_record_lines_calculation_mode_snapshot
    CHECK (calculation_mode_snapshot IN ('TIME_HOURLY','TIME_ONLY','UNITS_PER_HOUR','UNITS_PER_UNIT','FIXED_AMOUNT'));
ALTER TABLE work_record_lines ADD CONSTRAINT ck_work_record_lines_time_only
    CHECK (calculation_mode_snapshot <> 'TIME_ONLY' OR (
        calculated_minutes > 0 AND hourly_rate_snapshot IS NULL AND rate_per_unit_snapshot IS NULL
        AND currency_snapshot IS NULL AND gross_amount = 0 AND quantity IS NULL
        AND fixed_amount_snapshot IS NULL
    ));
