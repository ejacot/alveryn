ALTER TABLE work_record_lines
    DROP CONSTRAINT ck_work_record_lines_valid_fields_v2;

ALTER TABLE work_record_lines
    ADD CONSTRAINT ck_work_record_lines_valid_fields_v2
        CHECK (
            (
                calculation_mode_snapshot = 'TIME_HOURLY'
                AND calculated_minutes > 0
                AND hourly_rate_snapshot IS NOT NULL
                AND hourly_rate_snapshot >= 0
                AND quantity IS NULL
                AND fixed_amount_snapshot IS NULL
                AND rate_per_unit_snapshot IS NULL
                AND (
                    (start_time IS NOT NULL AND end_time IS NOT NULL
                        AND break_minutes IS NOT NULL AND break_minutes >= 0
                        AND duration_minutes IS NULL)
                    OR
                    (start_time IS NULL AND end_time IS NULL AND break_minutes IS NULL
                        AND duration_minutes IS NOT NULL AND duration_minutes > 0)
                )
            )
            OR (
                calculation_mode_snapshot = 'UNITS_PER_HOUR'
                AND quantity IS NOT NULL AND quantity > 0
                AND fixed_amount_snapshot IS NULL
                AND units_per_hour_snapshot IS NOT NULL AND units_per_hour_snapshot > 0
                AND calculated_minutes > 0
                AND hourly_rate_snapshot IS NOT NULL AND hourly_rate_snapshot >= 0
                AND rate_per_unit_snapshot IS NULL
            )
            OR (
                calculation_mode_snapshot = 'UNITS_PER_UNIT'
                AND quantity IS NOT NULL AND quantity > 0
                AND fixed_amount_snapshot IS NULL
                AND calculated_minutes >= 0
                AND rate_per_unit_snapshot IS NOT NULL AND rate_per_unit_snapshot > 0
                AND hourly_rate_snapshot IS NULL
            )
            OR (
                calculation_mode_snapshot = 'FIXED_AMOUNT'
                AND quantity IS NULL
                AND fixed_amount_snapshot IS NOT NULL AND fixed_amount_snapshot > 0
                AND calculated_minutes = 0
                AND hourly_rate_snapshot IS NULL
                AND rate_per_unit_snapshot IS NULL
                AND units_per_hour_snapshot IS NULL
                AND start_time IS NULL AND end_time IS NULL
                AND break_minutes IS NULL AND duration_minutes IS NULL
            )
        );
