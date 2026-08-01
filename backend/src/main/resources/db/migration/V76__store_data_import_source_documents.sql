ALTER TABLE data_import_batches
  ADD COLUMN source_content_type VARCHAR(100),
  ADD COLUMN source_content BYTEA;

ALTER TABLE data_import_batches
  ADD CONSTRAINT ck_data_import_source_content_size
  CHECK (source_content IS NULL OR octet_length(source_content) <= 10485760);
