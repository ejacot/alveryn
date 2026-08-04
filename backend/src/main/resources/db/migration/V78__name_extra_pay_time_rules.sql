alter table employment_extra_pay_time_rules
    add column name varchar(80) not null default 'Time interval';

alter table employment_extra_pay_time_rules
    alter column name drop default;
