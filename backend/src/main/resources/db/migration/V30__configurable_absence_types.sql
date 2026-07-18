ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) NOT NULL DEFAULT 'FULL_TIME';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_profiles_employment_type') THEN
        ALTER TABLE user_profiles
            ADD CONSTRAINT ck_user_profiles_employment_type
            CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'MINI_JOB', 'FREELANCE', 'CONTRACTOR', 'OTHER'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS absence_types (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(80) NOT NULL,
    normalized_name VARCHAR(80) NOT NULL,
    code VARCHAR(30),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_minutes_per_day INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7) NOT NULL DEFAULT '#A3A3A3',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_absence_types_user') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT fk_absence_types_user
            FOREIGN KEY (user_id) REFERENCES user_accounts (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_absence_types_user_name') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT uk_absence_types_user_name UNIQUE (user_id, normalized_name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_absence_types_code') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT ck_absence_types_code
            CHECK (code IS NULL OR code IN ('DAY_OFF', 'VACATION', 'SICK_LEAVE', 'PUBLIC_HOLIDAY'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_absence_types_paid_minutes') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT ck_absence_types_paid_minutes
            CHECK (paid_minutes_per_day BETWEEN 0 AND 1440 AND (paid OR paid_minutes_per_day = 0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_absence_types_color') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT ck_absence_types_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_absence_types_display_order') THEN
        ALTER TABLE absence_types
            ADD CONSTRAINT ck_absence_types_display_order CHECK (display_order >= 0);
    END IF;
END $$;

INSERT INTO absence_types (id, user_id, name, normalized_name, code, paid, paid_minutes_per_day, color, display_order)
SELECT gen_random_uuid(), u.id, defaults.name, lower(defaults.name), defaults.code,
       CASE
           WHEN defaults.code = 'DAY_OFF' THEN FALSE
           WHEN COALESCE(p.employment_type, 'FULL_TIME') = 'MINI_JOB' THEN FALSE
           WHEN defaults.code IN ('VACATION', 'SICK_LEAVE', 'PUBLIC_HOLIDAY') THEN TRUE
           ELSE FALSE
       END,
       CASE
           WHEN defaults.code = 'DAY_OFF' THEN 0
           WHEN COALESCE(p.employment_type, 'FULL_TIME') = 'MINI_JOB' THEN 0
           WHEN COALESCE(p.employment_type, 'FULL_TIME') = 'PART_TIME' THEN 360
           ELSE 480
       END,
       defaults.color,
       defaults.display_order
FROM user_accounts u
LEFT JOIN user_profiles p ON p.user_id = u.id
CROSS JOIN (
    VALUES
        ('Free', 'DAY_OFF', '#A3A3A3', 0),
        ('Vacation', 'VACATION', '#10B981', 1),
        ('Sick', 'SICK_LEAVE', '#EF4444', 2),
        ('Holiday', 'PUBLIC_HOLIDAY', '#60A5FA', 3)
) AS defaults(name, code, color, display_order)
WHERE NOT EXISTS (
    SELECT 1
    FROM absence_types existing
    WHERE existing.user_id = u.id
      AND existing.code = defaults.code
);

ALTER TABLE absences
    ADD COLUMN IF NOT EXISTS absence_type_id UUID,
    ADD COLUMN IF NOT EXISTS absence_type_name_snapshot VARCHAR(80),
    ADD COLUMN IF NOT EXISTS paid_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS paid_minutes_per_day_snapshot INTEGER NOT NULL DEFAULT 0;

UPDATE absences a
SET absence_type_id = at.id,
    absence_type_name_snapshot = at.name,
    paid_snapshot = at.paid,
    paid_minutes_per_day_snapshot = at.paid_minutes_per_day
FROM absence_types at
WHERE at.user_id = a.user_id
  AND at.code = a.absence_type
  AND a.absence_type_id IS NULL;

UPDATE absences
SET absence_type_name_snapshot = CASE absence_type
    WHEN 'VACATION' THEN 'Vacation'
    WHEN 'SICK_LEAVE' THEN 'Sick'
    WHEN 'PUBLIC_HOLIDAY' THEN 'Holiday'
    ELSE 'Free'
END
WHERE absence_type_name_snapshot IS NULL;

ALTER TABLE absences
    ALTER COLUMN absence_type_name_snapshot SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_absences_absence_type') THEN
        ALTER TABLE absences
            ADD CONSTRAINT fk_absences_absence_type
            FOREIGN KEY (absence_type_id) REFERENCES absence_types (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_absences_paid_snapshot_minutes') THEN
        ALTER TABLE absences
            ADD CONSTRAINT ck_absences_paid_snapshot_minutes
            CHECK (paid_minutes_per_day_snapshot BETWEEN 0 AND 1440 AND (paid_snapshot OR paid_minutes_per_day_snapshot = 0));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_absence_types_user_active ON absence_types (user_id, active, display_order);
CREATE INDEX IF NOT EXISTS idx_absences_user_absence_type ON absences (user_id, absence_type_id);
