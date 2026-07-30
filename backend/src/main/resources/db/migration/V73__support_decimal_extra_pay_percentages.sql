alter table work_record_lines
    alter column extra_pay_percentage type numeric(7, 4)
    using extra_pay_percentage::numeric(7, 4);

alter table data_import_work_type_mappings
    alter column extra_pay_percentage type numeric(7, 4)
    using extra_pay_percentage::numeric(7, 4);

alter table employment_extra_pay_rules
    alter column percentage type numeric(7, 4)
    using percentage::numeric(7, 4);
