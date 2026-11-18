ALTER TABLE product_events
    DROP CONSTRAINT ck_product_events_type,
    ADD CONSTRAINT ck_product_events_type
        CHECK (event_type IN ('PDF_EXPORTED', 'LANDING_VIEW', 'DEMO_STARTED', 'REGISTRATION_STARTED'));
