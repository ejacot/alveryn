ALTER TABLE user_preferences
    ADD COLUMN guide_version_completed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_preferences
    ADD CONSTRAINT chk_user_preferences_guide_version_non_negative
        CHECK (guide_version_completed >= 0);
