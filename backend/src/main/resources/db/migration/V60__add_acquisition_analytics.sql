ALTER TABLE product_events
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE product_events
    ADD COLUMN anonymous_id UUID;

ALTER TABLE product_events
    DROP CONSTRAINT ck_product_events_type;

ALTER TABLE product_events
    ADD CONSTRAINT ck_product_events_type
        CHECK (event_type IN ('PDF_EXPORTED', 'LANDING_VIEW', 'REGISTRATION_STARTED'));

ALTER TABLE product_events
    ADD CONSTRAINT ck_product_events_owner
        CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL);

CREATE INDEX ix_product_events_anonymous_date
    ON product_events(anonymous_id, occurred_at)
    WHERE anonymous_id IS NOT NULL;
