CREATE TABLE employment_rest_days (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    employment_id UUID NOT NULL,
    rest_date DATE NOT NULL,
    source VARCHAR(20) NOT NULL,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_employment_rest_days_user
        FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_employment_rest_days_employment
        FOREIGN KEY (employment_id) REFERENCES employments(id) ON DELETE CASCADE,
    CONSTRAINT uq_employment_rest_days_employment_date
        UNIQUE (employment_id, rest_date),
    CONSTRAINT ck_employment_rest_days_source
        CHECK (source IN ('MANUAL'))
);

CREATE INDEX idx_employment_rest_days_user_date
    ON employment_rest_days (user_id, rest_date);

CREATE INDEX idx_employment_rest_days_employment_date
    ON employment_rest_days (employment_id, rest_date);
