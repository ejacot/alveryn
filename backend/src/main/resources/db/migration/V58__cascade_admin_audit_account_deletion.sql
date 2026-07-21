ALTER TABLE admin_audit_events
    DROP CONSTRAINT admin_audit_events_admin_user_id_fkey;

ALTER TABLE admin_audit_events
    ADD CONSTRAINT fk_admin_audit_events_admin_user
        FOREIGN KEY (admin_user_id) REFERENCES user_accounts(id) ON DELETE CASCADE;
