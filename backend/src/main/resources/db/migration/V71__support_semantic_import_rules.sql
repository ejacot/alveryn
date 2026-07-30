alter table data_import_work_type_mappings
    alter column work_type_id drop not null;

alter table data_import_work_type_mappings
    add column semantic_role varchar(30) not null default 'ACTIVITY',
    add column extra_pay_percentage integer;

alter table data_import_work_type_mappings
    add constraint chk_import_mapping_semantic_role
        check (semantic_role in ('ACTIVITY', 'SURCHARGE')),
    add constraint chk_import_mapping_extra_pay
        check (
            (semantic_role = 'ACTIVITY' and work_type_id is not null and extra_pay_percentage is null)
            or
            (semantic_role = 'SURCHARGE' and extra_pay_percentage between 1 and 1000)
        );
