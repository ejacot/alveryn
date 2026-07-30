ALTER TABLE data_import_batches
    ADD COLUMN import_scope VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
    ADD COLUMN employment_id UUID REFERENCES employments(id) ON DELETE RESTRICT;

ALTER TABLE data_import_batches
    ADD CONSTRAINT chk_data_import_scope
        CHECK (import_scope IN ('SINGLE', 'MULTIPLE')),
    ADD CONSTRAINT chk_data_import_single_employment
        CHECK (
            (import_scope = 'SINGLE' AND employment_id IS NOT NULL)
            OR (import_scope = 'MULTIPLE' AND employment_id IS NULL)
        );

ALTER TABLE data_import_batches
    ALTER COLUMN import_scope DROP DEFAULT;

CREATE INDEX idx_data_import_batches_employment
    ON data_import_batches(employment_id)
    WHERE employment_id IS NOT NULL;
