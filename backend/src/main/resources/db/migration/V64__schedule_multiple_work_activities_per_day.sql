ALTER TABLE schedule_template_rules DROP CONSTRAINT ux_schedule_rule_day;

ALTER TABLE schedule_template_rules
    ADD COLUMN work_type_id UUID REFERENCES work_types(id) ON DELETE SET NULL,
    ADD COLUMN work_type_name_snapshot VARCHAR(100) NOT NULL DEFAULT 'Planned work',
    ADD COLUMN work_type_color_snapshot VARCHAR(7) NOT NULL DEFAULT '#87C95A';

CREATE INDEX ix_schedule_rules_template_day
    ON schedule_template_rules(template_id, day_of_week, start_local_time);

ALTER TABLE scheduled_shifts
    ADD COLUMN work_type_id UUID REFERENCES work_types(id) ON DELETE SET NULL,
    ADD COLUMN work_type_name_snapshot VARCHAR(100) NOT NULL DEFAULT 'Planned work',
    ADD COLUMN work_type_color_snapshot VARCHAR(7) NOT NULL DEFAULT '#87C95A';

UPDATE scheduled_shifts s
SET work_type_id = r.work_type_id,
    work_type_name_snapshot = r.work_type_name_snapshot,
    work_type_color_snapshot = r.work_type_color_snapshot
FROM schedule_template_rules r
WHERE r.id = s.template_rule_id;
