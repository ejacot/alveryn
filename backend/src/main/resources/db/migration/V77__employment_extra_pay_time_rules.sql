create table employment_extra_pay_time_rules (
    id uuid primary key,
    employment_id uuid not null references employments(id) on delete cascade,
    start_time time not null,
    end_time time not null,
    percentage numeric(7, 4) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_extra_pay_time_interval check (start_time <> end_time),
    constraint chk_extra_pay_time_percentage check (percentage > 0 and percentage <= 1000)
);

create index idx_extra_pay_time_rules_employment
    on employment_extra_pay_time_rules(employment_id);
