-- Safety cleanup for environments where the former V9 local seed was applied.
-- The development account is now created only by the Spring local profile.

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM unit_entry_items
WHERE work_entry_id IN (SELECT id FROM work_entries WHERE user_id IN (SELECT id FROM target_user))
   OR unit_type_id IN (
       SELECT unit_types.id
       FROM unit_types
       JOIN work_types ON work_types.id = unit_types.work_type_id
       WHERE work_types.user_id IN (SELECT id FROM target_user)
   );

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM time_entry_details
WHERE work_entry_id IN (SELECT id FROM work_entries WHERE user_id IN (SELECT id FROM target_user));

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM work_entries
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM unit_types
WHERE work_type_id IN (SELECT id FROM work_types WHERE user_id IN (SELECT id FROM target_user));

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM work_types
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM hourly_rate_periods
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM absences
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM excel_import_batches
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
UPDATE refresh_tokens
SET replaced_by_token_id = NULL
WHERE replaced_by_token_id IN (SELECT id FROM refresh_tokens WHERE user_id IN (SELECT id FROM target_user));

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM refresh_tokens
WHERE user_id IN (SELECT id FROM target_user);

WITH target_user AS (
    SELECT id
    FROM user_accounts
    WHERE lower(email) = 'eusebiujacot@gmail.com'
)
DELETE FROM password_reset_tokens
WHERE user_id IN (SELECT id FROM target_user);

DELETE FROM user_accounts
WHERE lower(email) = 'eusebiujacot@gmail.com';
