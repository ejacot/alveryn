CREATE TABLE excel_import_batches (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    detected_year INTEGER NOT NULL,
    imported_entries_count INTEGER NOT NULL,
    imported_absences_count INTEGER NOT NULL,
    CONSTRAINT fk_excel_import_batches_user
        FOREIGN KEY (user_id)
            REFERENCES user_accounts (id)
            ON DELETE CASCADE,
    CONSTRAINT uk_excel_import_batches_user_hash
        UNIQUE (user_id, file_sha256)
);

CREATE INDEX idx_excel_import_batches_user_created
    ON excel_import_batches (user_id, created_at DESC);
