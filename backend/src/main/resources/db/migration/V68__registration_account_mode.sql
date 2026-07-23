ALTER TABLE user_preferences
    ADD COLUMN account_mode VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
    ADD CONSTRAINT ck_user_preferences_account_mode
        CHECK (account_mode IN ('PERSONAL', 'BUSINESS'));
