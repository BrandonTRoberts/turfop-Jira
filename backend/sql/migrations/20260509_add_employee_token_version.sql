alter table employees add column if not exists token_version integer not null default 0;
update employees set token_version = coalesce(token_version, 0) where token_version is null;
