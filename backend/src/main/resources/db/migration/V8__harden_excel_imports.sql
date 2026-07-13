ALTER TABLE excel_import_batches
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN recognized_sheets_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN skipped_rows_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN imported_work_type_id UUID NULL,
    ADD COLUMN file_size_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN confirmed_at TIMESTAMPTZ NULL,
    ADD COLUMN undone_at TIMESTAMPTZ NULL,
    ADD COLUMN previewed_at TIMESTAMPTZ NULL,
    ADD COLUMN preview_expires_at TIMESTAMPTZ NULL,
    ADD COLUMN preview_token_hash CHAR(64) NULL,
    ADD COLUMN preview_payload_json TEXT NULL,
    ADD COLUMN created_fallback_work_type BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE excel_import_batches
SET status = 'COMPLETED',
    confirmed_at = created_at
WHERE confirmed_at IS NULL;

ALTER TABLE excel_import_batches
    ADD CONSTRAINT fk_excel_import_batches_work_type
        FOREIGN KEY (imported_work_type_id)
            REFERENCES work_types (id)
            ON DELETE SET NULL;

CREATE INDEX idx_excel_import_batches_user_status_created
    ON excel_import_batches (user_id, status, created_at DESC);

CREATE INDEX idx_excel_import_batches_preview_token_hash
    ON excel_import_batches (preview_token_hash);

ALTER TABLE work_entries
    ADD COLUMN import_batch_id UUID NULL,
    ADD COLUMN import_source_key VARCHAR(255) NULL,
    ADD COLUMN import_fingerprint CHAR(64) NULL;

ALTER TABLE work_entries
    ADD CONSTRAINT fk_work_entries_import_batch
        FOREIGN KEY (import_batch_id)
            REFERENCES excel_import_batches (id)
            ON DELETE SET NULL;

CREATE INDEX idx_work_entries_user_import_source_key
    ON work_entries (user_id, import_source_key);

CREATE INDEX idx_work_entries_import_batch
    ON work_entries (import_batch_id);

ALTER TABLE absences
    ADD COLUMN import_batch_id UUID NULL,
    ADD COLUMN import_source_key VARCHAR(255) NULL,
    ADD COLUMN import_fingerprint CHAR(64) NULL;

ALTER TABLE absences
    ADD CONSTRAINT fk_absences_import_batch
        FOREIGN KEY (import_batch_id)
            REFERENCES excel_import_batches (id)
            ON DELETE SET NULL;

CREATE INDEX idx_absences_user_import_source_key
    ON absences (user_id, import_source_key);

CREATE INDEX idx_absences_import_batch
    ON absences (import_batch_id);
