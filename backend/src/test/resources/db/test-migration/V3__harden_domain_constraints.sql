ALTER TABLE user_accounts
    ADD CONSTRAINT ck_user_accounts_security_code_pair
        CHECK ((security_code_hash IS NULL) = (security_code_expires_at IS NULL));

ALTER TABLE user_preferences
    ADD CONSTRAINT ck_user_preferences_currency
        CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$'));

ALTER TABLE hourly_rate_periods
    ADD CONSTRAINT ck_hourly_rate_periods_currency
        CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$'));

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_currency
        CHECK (REGEXP_LIKE(currency_snapshot, '^[A-Z]{3}$'));

ALTER TABLE work_entries
    ADD CONSTRAINT ck_work_entries_gross_calculation
        CHECK (gross_amount = ROUND(hourly_rate_snapshot * calculated_minutes / 60, 2));

ALTER TABLE unit_entry_items
    ADD CONSTRAINT ck_unit_entry_items_minutes_calculation
        CHECK (calculated_minutes = ROUND(quantity * 60 / units_per_hour_snapshot));
