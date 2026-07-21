ALTER TABLE user_accounts
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';

ALTER TABLE user_accounts
    ADD CONSTRAINT ck_user_accounts_role CHECK (role IN ('USER', 'ADMIN'));

CREATE TABLE user_activity_days (
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX ix_user_activity_days_date ON user_activity_days(activity_date, user_id);

CREATE TABLE product_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_product_events_type CHECK (event_type IN ('PDF_EXPORTED'))
);

CREATE INDEX ix_product_events_type_date ON product_events(event_type, occurred_at);
CREATE INDEX ix_product_events_user_date ON product_events(user_id, occurred_at);

CREATE TABLE admin_audit_events (
    id UUID PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES user_accounts(id),
    action VARCHAR(80) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_admin_audit_events_admin_date ON admin_audit_events(admin_user_id, occurred_at);
