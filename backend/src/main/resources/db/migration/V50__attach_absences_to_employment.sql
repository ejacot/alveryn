ALTER TABLE absences ADD COLUMN employment_id UUID;

UPDATE absences a
SET employment_id = (
    SELECT e.id
    FROM employments e
    WHERE e.user_id = a.user_id
    ORDER BY e.active DESC, e.display_order ASC, e.created_at ASC
    LIMIT 1
);

ALTER TABLE absences ALTER COLUMN employment_id SET NOT NULL;
ALTER TABLE absences
    ADD CONSTRAINT fk_absences_employment
        FOREIGN KEY (employment_id) REFERENCES employments(id);

CREATE INDEX ix_absences_employment_dates
    ON absences(employment_id, start_date, end_date);
