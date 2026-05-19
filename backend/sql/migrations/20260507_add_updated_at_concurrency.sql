begin;

alter table work_orders add column if not exists updated_at timestamptz;
update work_orders set updated_at = created_at where updated_at is null;
update work_orders set updated_at = now() where updated_at is null;
alter table work_orders alter column updated_at set default now();
alter table work_orders alter column updated_at set not null;

alter table equipment add column if not exists updated_at timestamptz;
update equipment set updated_at = created_at where updated_at is null;
update equipment set updated_at = now() where updated_at is null;
alter table equipment alter column updated_at set default now();
alter table equipment alter column updated_at set not null;

commit;
