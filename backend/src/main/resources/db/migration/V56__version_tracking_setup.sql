ALTER TABLE user_preferences
    ADD COLUMN tracking_setup_version_completed INTEGER NOT NULL DEFAULT 0;
