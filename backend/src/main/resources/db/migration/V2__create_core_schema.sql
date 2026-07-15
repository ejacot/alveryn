-- =========================================================
-- Alveryn core database schema
-- =========================================================

CREATE TABLE user_accounts (
                               id UUID PRIMARY KEY,

                               email VARCHAR(255) NOT NULL,
                               password_hash VARCHAR(255) NOT NULL,

                               email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                               status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

                               security_code_hash VARCHAR(255),
                               security_code_expires_at TIMESTAMPTZ,

                               failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                               locked_until TIMESTAMPTZ,
                               last_login_at TIMESTAMPTZ,

                               created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                               updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                               CONSTRAINT uk_user_accounts_email UNIQUE (email),

                               CONSTRAINT ck_user_accounts_status
                                   CHECK (status IN ('ACTIVE', 'LOCKED', 'DELETED')),

                               CONSTRAINT ck_user_accounts_failed_attempts
                                   CHECK (failed_login_attempts >= 0)
);


CREATE TABLE user_profiles (
                               id UUID PRIMARY KEY,
                               user_id UUID NOT NULL,

                               first_name VARCHAR(80),
                               last_name VARCHAR(80),
                               display_name VARCHAR(100),

                               date_of_birth DATE,
                               phone VARCHAR(30),

                               country_code VARCHAR(2),
                               city VARCHAR(100),
                               postal_code VARCHAR(20),
                               street VARCHAR(150),
                               house_number VARCHAR(30),
                               apartment VARCHAR(30),

                               avatar_url VARCHAR(500),

                               employment_start_date DATE,
                               employment_end_date DATE,

                               created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                               updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                               CONSTRAINT fk_user_profiles_user
                                   FOREIGN KEY (user_id)
                                       REFERENCES user_accounts (id)
                                       ON DELETE CASCADE,

                               CONSTRAINT uk_user_profiles_user UNIQUE (user_id),

                               CONSTRAINT ck_user_profiles_employment_dates
                                   CHECK (
                                       employment_end_date IS NULL
                                           OR employment_start_date IS NULL
                                           OR employment_end_date >= employment_start_date
                                       )
);


CREATE TABLE user_preferences (
                                  id UUID PRIMARY KEY,
                                  user_id UUID NOT NULL,

                                  language VARCHAR(10) NOT NULL DEFAULT 'ro',
                                  timezone VARCHAR(60) NOT NULL DEFAULT 'Europe/Berlin',
                                  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

                                  first_day_of_week VARCHAR(10) NOT NULL DEFAULT 'MONDAY',
                                  date_format VARCHAR(30) NOT NULL DEFAULT 'DD.MM.YYYY',
                                  time_format VARCHAR(10) NOT NULL DEFAULT 'H24',
                                  theme VARCHAR(10) NOT NULL DEFAULT 'SYSTEM',

                                  default_break_minutes INTEGER NOT NULL DEFAULT 30,
                                  preferred_daily_minutes INTEGER,

                                  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,

                                  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                  CONSTRAINT fk_user_preferences_user
                                      FOREIGN KEY (user_id)
                                          REFERENCES user_accounts (id)
                                          ON DELETE CASCADE,

                                  CONSTRAINT uk_user_preferences_user UNIQUE (user_id),

                                  CONSTRAINT ck_user_preferences_first_day
                                      CHECK (first_day_of_week IN ('MONDAY', 'SUNDAY')),

                                  CONSTRAINT ck_user_preferences_time_format
                                      CHECK (time_format IN ('H12', 'H24')),

                                  CONSTRAINT ck_user_preferences_theme
                                      CHECK (theme IN ('LIGHT', 'DARK', 'SYSTEM')),

                                  CONSTRAINT ck_user_preferences_break
                                      CHECK (default_break_minutes >= 0),

                                  CONSTRAINT ck_user_preferences_daily_minutes
                                      CHECK (
                                          preferred_daily_minutes IS NULL
                                              OR preferred_daily_minutes > 0
                                          )
);


CREATE TABLE hourly_rate_periods (
                                     id UUID PRIMARY KEY,
                                     user_id UUID NOT NULL,

                                     hourly_rate NUMERIC(10, 2) NOT NULL,
                                     currency VARCHAR(3) NOT NULL,

                                     valid_from DATE NOT NULL,
                                     valid_to DATE,

                                     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                     CONSTRAINT fk_hourly_rate_periods_user
                                         FOREIGN KEY (user_id)
                                             REFERENCES user_accounts (id)
                                             ON DELETE CASCADE,

                                     CONSTRAINT ck_hourly_rate_periods_rate
                                         CHECK (hourly_rate >= 0),

                                     CONSTRAINT ck_hourly_rate_periods_dates
                                         CHECK (valid_to IS NULL OR valid_to >= valid_from)
);


CREATE TABLE work_types (
                            id UUID PRIMARY KEY,
                            user_id UUID NOT NULL,

                            name VARCHAR(100) NOT NULL,
                            normalized_name VARCHAR(100) NOT NULL,

                            calculation_method VARCHAR(30) NOT NULL,

                            color VARCHAR(7) NOT NULL DEFAULT '#87C95A',
                            icon VARCHAR(100),

                            default_break_minutes INTEGER,
                            active BOOLEAN NOT NULL DEFAULT TRUE,
                            display_order INTEGER NOT NULL DEFAULT 0,

                            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                            CONSTRAINT fk_work_types_user
                                FOREIGN KEY (user_id)
                                    REFERENCES user_accounts (id)
                                    ON DELETE CASCADE,

                            CONSTRAINT uk_work_types_user_name
                                UNIQUE (user_id, normalized_name),

                            CONSTRAINT ck_work_types_calculation_method
                                CHECK (calculation_method IN ('TIME_BASED', 'UNIT_BASED')),

                            CONSTRAINT ck_work_types_color
                                CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),

    CONSTRAINT ck_work_types_break
        CHECK (
            default_break_minutes IS NULL
            OR default_break_minutes >= 0
        ),

    CONSTRAINT ck_work_types_display_order
        CHECK (display_order >= 0)
);


CREATE TABLE unit_types (
                            id UUID PRIMARY KEY,
                            work_type_id UUID NOT NULL,

                            name VARCHAR(100) NOT NULL,
                            normalized_name VARCHAR(100) NOT NULL,

                            units_per_hour NUMERIC(10, 4) NOT NULL,

                            active BOOLEAN NOT NULL DEFAULT TRUE,
                            display_order INTEGER NOT NULL DEFAULT 0,

                            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                            CONSTRAINT fk_unit_types_work_type
                                FOREIGN KEY (work_type_id)
                                    REFERENCES work_types (id)
                                    ON DELETE CASCADE,

                            CONSTRAINT uk_unit_types_work_type_name
                                UNIQUE (work_type_id, normalized_name),

                            CONSTRAINT ck_unit_types_units_per_hour
                                CHECK (units_per_hour > 0),

                            CONSTRAINT ck_unit_types_display_order
                                CHECK (display_order >= 0)
);


CREATE TABLE work_entries (
                              id UUID PRIMARY KEY,

                              user_id UUID NOT NULL,
                              work_type_id UUID NOT NULL,
                              work_date DATE NOT NULL,

                              work_type_name_snapshot VARCHAR(100) NOT NULL,
                              calculation_method_snapshot VARCHAR(30) NOT NULL,

                              hourly_rate_snapshot NUMERIC(10, 2) NOT NULL,
                              currency_snapshot VARCHAR(3) NOT NULL,

                              calculated_minutes INTEGER NOT NULL,
                              gross_amount NUMERIC(12, 2) NOT NULL,

                              notes VARCHAR(500),

                              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                              CONSTRAINT fk_work_entries_user
                                  FOREIGN KEY (user_id)
                                      REFERENCES user_accounts (id)
                                      ON DELETE CASCADE,

                              CONSTRAINT fk_work_entries_work_type
                                  FOREIGN KEY (work_type_id)
                                      REFERENCES work_types (id),

                              CONSTRAINT ck_work_entries_calculation_method
                                  CHECK (
                                      calculation_method_snapshot IN ('TIME_BASED', 'UNIT_BASED')
                                      ),

                              CONSTRAINT ck_work_entries_hourly_rate
                                  CHECK (hourly_rate_snapshot >= 0),

                              CONSTRAINT ck_work_entries_calculated_minutes
                                  CHECK (calculated_minutes > 0),

                              CONSTRAINT ck_work_entries_gross_amount
                                  CHECK (gross_amount >= 0)
);


CREATE TABLE time_entry_details (
                                    id UUID PRIMARY KEY,
                                    work_entry_id UUID NOT NULL,

                                    start_time TIME NOT NULL,
                                    end_time TIME NOT NULL,

                                    break_minutes INTEGER NOT NULL DEFAULT 0,
                                    total_interval_minutes INTEGER NOT NULL,

                                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                    CONSTRAINT fk_time_entry_details_work_entry
                                        FOREIGN KEY (work_entry_id)
                                            REFERENCES work_entries (id)
                                            ON DELETE CASCADE,

                                    CONSTRAINT uk_time_entry_details_work_entry
                                        UNIQUE (work_entry_id),

                                    CONSTRAINT ck_time_entry_details_break
                                        CHECK (break_minutes >= 0),

                                    CONSTRAINT ck_time_entry_details_total_interval
                                        CHECK (total_interval_minutes > 0),

                                    CONSTRAINT ck_time_entry_details_break_interval
                                        CHECK (break_minutes < total_interval_minutes)
);


CREATE TABLE unit_entry_items (
                                  id UUID PRIMARY KEY,

                                  work_entry_id UUID NOT NULL,
                                  unit_type_id UUID NOT NULL,

                                  unit_name_snapshot VARCHAR(100) NOT NULL,

                                  quantity NUMERIC(12, 2) NOT NULL,
                                  units_per_hour_snapshot NUMERIC(10, 4) NOT NULL,
                                  calculated_minutes INTEGER NOT NULL,

                                  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                  CONSTRAINT fk_unit_entry_items_work_entry
                                      FOREIGN KEY (work_entry_id)
                                          REFERENCES work_entries (id)
                                          ON DELETE CASCADE,

                                  CONSTRAINT fk_unit_entry_items_unit_type
                                      FOREIGN KEY (unit_type_id)
                                          REFERENCES unit_types (id),

                                  CONSTRAINT uk_unit_entry_items_entry_type
                                      UNIQUE (work_entry_id, unit_type_id),

                                  CONSTRAINT ck_unit_entry_items_quantity
                                      CHECK (quantity > 0),

                                  CONSTRAINT ck_unit_entry_items_units_per_hour
                                      CHECK (units_per_hour_snapshot > 0),

                                  CONSTRAINT ck_unit_entry_items_minutes
                                      CHECK (calculated_minutes > 0)
);


CREATE TABLE absences (
                          id UUID PRIMARY KEY,
                          user_id UUID NOT NULL,

                          absence_type VARCHAR(30) NOT NULL,
                          start_date DATE NOT NULL,
                          end_date DATE NOT NULL,

                          notes VARCHAR(500),

                          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                          CONSTRAINT fk_absences_user
                              FOREIGN KEY (user_id)
                                  REFERENCES user_accounts (id)
                                  ON DELETE CASCADE,

                          CONSTRAINT ck_absences_type
                              CHECK (
                                  absence_type IN (
                                                   'DAY_OFF',
                                                   'VACATION',
                                                   'SICK_LEAVE',
                                                   'PUBLIC_HOLIDAY'
                                      )
                                  ),

                          CONSTRAINT ck_absences_dates
                              CHECK (end_date >= start_date)
);


-- =========================================================
-- Indexes
-- =========================================================

CREATE INDEX idx_hourly_rate_periods_user_dates
    ON hourly_rate_periods (user_id, valid_from, valid_to);

CREATE INDEX idx_work_types_user_active
    ON work_types (user_id, active);

CREATE INDEX idx_unit_types_work_type_active
    ON unit_types (work_type_id, active);

CREATE INDEX idx_work_entries_user_date
    ON work_entries (user_id, work_date);

CREATE INDEX idx_work_entries_user_type_date
    ON work_entries (user_id, work_type_id, work_date);

CREATE INDEX idx_absences_user_dates
    ON absences (user_id, start_date, end_date);
