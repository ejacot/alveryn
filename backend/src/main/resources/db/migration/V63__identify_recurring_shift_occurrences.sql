ALTER TABLE scheduled_shifts
    ADD COLUMN template_occurrence_date DATE;

UPDATE scheduled_shifts
SET template_occurrence_date = (starts_at AT TIME ZONE timezone)::DATE
WHERE template_rule_id IS NOT NULL;

CREATE UNIQUE INDEX ux_scheduled_shift_template_occurrence
    ON scheduled_shifts(template_rule_id, template_occurrence_date)
    WHERE template_rule_id IS NOT NULL;
