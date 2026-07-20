ALTER TABLE hourly_rate_periods ADD COLUMN employment_id UUID;

UPDATE hourly_rate_periods rate
SET employment_id = (
    SELECT employment.id FROM employments employment
    WHERE employment.user_id = rate.user_id
    ORDER BY CASE WHEN employment.compensation_type = 'HOURLY' THEN 0 ELSE 1 END,
             employment.display_order, employment.created_at
    LIMIT 1
);

ALTER TABLE hourly_rate_periods ALTER COLUMN employment_id SET NOT NULL;
ALTER TABLE hourly_rate_periods ADD CONSTRAINT fk_hourly_rates_employment
    FOREIGN KEY (employment_id) REFERENCES employments(id);
CREATE INDEX ix_hourly_rates_employment_period ON hourly_rate_periods(employment_id, valid_from, valid_to);
