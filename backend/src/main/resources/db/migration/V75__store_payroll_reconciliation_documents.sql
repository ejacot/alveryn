CREATE TABLE payroll_reconciliation_documents (
  id UUID PRIMARY KEY,
  reconciliation_id UUID NOT NULL REFERENCES payroll_reconciliations(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  content_size BIGINT NOT NULL,
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_payroll_reconciliation_document UNIQUE (reconciliation_id),
  CONSTRAINT ck_payroll_reconciliation_document_size
    CHECK (content_size > 0 AND content_size <= 15728640)
);
