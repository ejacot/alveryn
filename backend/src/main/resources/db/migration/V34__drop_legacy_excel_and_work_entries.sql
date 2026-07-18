ALTER TABLE IF EXISTS time_entry_details
    DROP CONSTRAINT IF EXISTS fk_time_entry_details_work_entry;

ALTER TABLE IF EXISTS work_entries
    DROP CONSTRAINT IF EXISTS fk_work_entries_import_batch,
    DROP CONSTRAINT IF EXISTS fk_work_entries_work_record,
    DROP CONSTRAINT IF EXISTS fk_work_entries_user,
    DROP CONSTRAINT IF EXISTS fk_work_entries_work_type;

ALTER TABLE IF EXISTS absences
    DROP CONSTRAINT IF EXISTS fk_absences_import_batch;

ALTER TABLE IF EXISTS excel_import_batches
    DROP CONSTRAINT IF EXISTS fk_excel_import_batches_user,
    DROP CONSTRAINT IF EXISTS fk_excel_import_batches_work_type;

ALTER TABLE IF EXISTS absences
    DROP COLUMN IF EXISTS import_batch_id,
    DROP COLUMN IF EXISTS import_source_key,
    DROP COLUMN IF EXISTS import_fingerprint;

DROP TABLE IF EXISTS time_entry_details;
DROP TABLE IF EXISTS work_entries;
DROP TABLE IF EXISTS excel_import_batches;
