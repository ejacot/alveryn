create table employment_extra_pay_rules (
    id uuid primary key,
    employment_id uuid not null references employments(id) on delete cascade,
    weekday varchar(10) not null,
    percentage integer not null,
    active boolean not null default true,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_employment_extra_pay_percentage check (percentage between 1 and 1000),
    constraint uk_employment_extra_pay_weekday unique (employment_id, weekday)
);

create index idx_employment_extra_pay_rules_employment
    on employment_extra_pay_rules(employment_id);
