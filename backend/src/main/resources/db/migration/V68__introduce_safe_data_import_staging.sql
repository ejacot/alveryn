CREATE TABLE data_import_batches (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    source_filename VARCHAR(255) NOT NULL,
    source_sha256 VARCHAR(64) NOT NULL,
    source_size BIGINT NOT NULL,
    format VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    workbook_data JSONB NOT NULL,
    analysis JSONB NOT NULL,
    error_message TEXT,
    imported_at TIMESTAMPTZ,
    reverted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_data_import_user_hash UNIQUE (user_id, source_sha256),
    CONSTRAINT chk_data_import_size CHECK (source_size > 0 AND source_size <= 10485760),
    CONSTRAINT chk_data_import_format CHECK (format IN ('XLSX')),
    CONSTRAINT chk_data_import_status CHECK (
        status IN ('ANALYZED', 'NEEDS_REVIEW', 'READY', 'IMPORTED', 'FAILED', 'REVERTED')
    )
);

CREATE INDEX idx_data_import_batches_user_created
    ON data_import_batches(user_id, created_at DESC);
