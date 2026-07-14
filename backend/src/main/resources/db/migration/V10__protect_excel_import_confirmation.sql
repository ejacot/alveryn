CREATE UNIQUE INDEX ux_work_entries_user_import_source_key
    ON work_entries (user_id, import_source_key)
    WHERE import_source_key IS NOT NULL;

CREATE UNIQUE INDEX ux_absences_user_import_source_key
    ON absences (user_id, import_source_key)
    WHERE import_source_key IS NOT NULL;
