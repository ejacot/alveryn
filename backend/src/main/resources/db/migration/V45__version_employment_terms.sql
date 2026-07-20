CREATE TABLE employment_terms (
    id UUID PRIMARY KEY,
    employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    compensation_type VARCHAR(30) NOT NULL,
    fixed_salary_amount NUMERIC(14,4),
    currency VARCHAR(3),
    target_minutes INTEGER,
    target_period VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_employment_terms_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT ck_employment_terms_compensation CHECK (compensation_type IN ('FIXED_SALARY','HOURLY','PER_UNIT','FIXED_AMOUNT')),
    CONSTRAINT ck_employment_terms_target_period CHECK (target_period IS NULL OR target_period IN ('WEEKLY','MONTHLY')),
    CONSTRAINT ck_employment_terms_fixed_target CHECK (compensation_type <> 'FIXED_SALARY' OR (target_minutes > 0 AND target_period IS NOT NULL))
);

CREATE UNIQUE INDEX ux_employment_terms_start ON employment_terms(employment_id, valid_from);
CREATE INDEX ix_employment_terms_period ON employment_terms(employment_id, valid_from, valid_to);

INSERT INTO employment_terms (id, employment_id, valid_from, valid_to, compensation_type,
                              fixed_salary_amount, currency, target_minutes, target_period)
SELECT gen_random_uuid(), id, COALESCE(start_date, DATE '1900-01-01'), end_date,
       compensation_type, fixed_salary_amount, currency, target_minutes, target_period
FROM employments;
