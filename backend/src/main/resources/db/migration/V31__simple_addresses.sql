CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    street VARCHAR(150) NOT NULL,
    street_2 VARCHAR(150),
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    country VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_addresses_user') THEN
        ALTER TABLE addresses
            ADD CONSTRAINT fk_addresses_user
            FOREIGN KEY (user_id) REFERENCES user_accounts (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_addresses_country') THEN
        ALTER TABLE addresses
            ADD CONSTRAINT ck_addresses_country CHECK (country ~ '^[A-Z]{2}$');
    END IF;
END $$;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS address_id UUID;

ALTER TABLE work_records
    ADD COLUMN IF NOT EXISTS address_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_profiles_address') THEN
        ALTER TABLE user_profiles
            ADD CONSTRAINT fk_user_profiles_address
            FOREIGN KEY (address_id) REFERENCES addresses (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_records_address') THEN
        ALTER TABLE work_records
            ADD CONSTRAINT fk_work_records_address
            FOREIGN KEY (address_id) REFERENCES addresses (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_address ON user_profiles (address_id);
CREATE INDEX IF NOT EXISTS idx_work_records_address ON work_records (address_id);
