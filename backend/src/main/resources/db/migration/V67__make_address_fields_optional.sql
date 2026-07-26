alter table addresses
    alter column street drop not null,
    alter column city drop not null,
    alter column country drop not null;
