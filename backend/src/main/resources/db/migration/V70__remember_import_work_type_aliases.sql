create table data_import_work_type_mappings (
    id uuid primary key,
    user_id uuid not null references user_accounts(id) on delete cascade,
    employment_id uuid not null references employments(id) on delete cascade,
    work_type_id uuid not null references work_types(id) on delete cascade,
    source_label varchar(100) not null,
    normalized_source_label varchar(100) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version bigint not null default 0,
    constraint uq_import_mapping_source
        unique (user_id, employment_id, normalized_source_label)
);

create index idx_import_mapping_work_type
    on data_import_work_type_mappings(work_type_id);
