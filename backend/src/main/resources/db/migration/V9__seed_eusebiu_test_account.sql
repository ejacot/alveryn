-- Local test account requested for manual device validation.
-- Password is BCrypt-hashed; the plain password is not stored.

INSERT INTO user_accounts (
    id,
    email,
    password_hash,
    email_verified,
    status,
    failed_login_attempts,
    locked_until,
    security_code_hash,
    security_code_expires_at,
    created_at,
    updated_at
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'eusebiujacot@gmail.com',
    '$2a$10$5Ivz.LtsGDiBeU8kDzRvUOWfLk6flrn36yziGwfoZWMEdOCdHay3W',
    TRUE,
    'ACTIVE',
    0,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    email_verified = TRUE,
    status = 'ACTIVE',
    failed_login_attempts = 0,
    locked_until = NULL,
    security_code_hash = NULL,
    security_code_expires_at = NULL,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_profiles (
    id,
    user_id,
    first_name,
    last_name,
    display_name,
    created_at,
    updated_at
)
VALUES (
    '22222222-2222-4222-8222-222222222222',
    (SELECT id FROM user_accounts WHERE email = 'eusebiujacot@gmail.com'),
    'Eusebiu',
    'Jacot',
    'Eusebiu Jacot',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_preferences (
    id,
    user_id,
    language,
    timezone,
    currency,
    first_day_of_week,
    date_format,
    time_format,
    theme,
    default_break_minutes,
    preferred_daily_minutes,
    onboarding_completed,
    created_at,
    updated_at
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    (SELECT id FROM user_accounts WHERE email = 'eusebiujacot@gmail.com'),
    'ro',
    'Europe/Berlin',
    'EUR',
    'MONDAY',
    'DD.MM.YYYY',
    'H24',
    'SYSTEM',
    30,
    NULL,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO UPDATE
SET language = EXCLUDED.language,
    timezone = EXCLUDED.timezone,
    currency = EXCLUDED.currency,
    first_day_of_week = EXCLUDED.first_day_of_week,
    date_format = EXCLUDED.date_format,
    time_format = EXCLUDED.time_format,
    theme = EXCLUDED.theme,
    default_break_minutes = EXCLUDED.default_break_minutes,
    onboarding_completed = TRUE,
    updated_at = CURRENT_TIMESTAMP;
