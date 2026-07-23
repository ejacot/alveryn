ALTER TABLE schedule_template_rules
    ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'ACTIVITY',
    ADD COLUMN absence_type_id UUID REFERENCES absence_types(id) ON DELETE SET NULL,
    ADD COLUMN absence_type_name_snapshot VARCHAR(80),
    ADD COLUMN absence_type_color_snapshot VARCHAR(7);

ALTER TABLE schedule_template_rules
    ALTER COLUMN work_type_name_snapshot DROP NOT NULL,
    ALTER COLUMN work_type_color_snapshot DROP NOT NULL;

ALTER TABLE schedule_template_rules
    ADD CONSTRAINT ck_schedule_rule_item_type CHECK (item_type IN ('ACTIVITY', 'ABSENCE')),
    ADD CONSTRAINT ck_schedule_rule_item_reference CHECK (
        (item_type = 'ACTIVITY' AND absence_type_id IS NULL)
        OR (item_type = 'ABSENCE' AND absence_type_id IS NOT NULL AND work_type_id IS NULL)
    );

ALTER TABLE scheduled_shifts
    ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'ACTIVITY',
    ADD COLUMN absence_type_id UUID REFERENCES absence_types(id) ON DELETE SET NULL,
    ADD COLUMN absence_type_name_snapshot VARCHAR(80),
    ADD COLUMN absence_type_color_snapshot VARCHAR(7);

ALTER TABLE scheduled_shifts
    ALTER COLUMN work_type_name_snapshot DROP NOT NULL,
    ALTER COLUMN work_type_color_snapshot DROP NOT NULL;

ALTER TABLE scheduled_shifts
    ADD CONSTRAINT ck_scheduled_shift_item_type CHECK (item_type IN ('ACTIVITY', 'ABSENCE'));
