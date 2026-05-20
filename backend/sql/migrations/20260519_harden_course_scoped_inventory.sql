alter table parts_inventory
  add column if not exists updated_at timestamptz;

update parts_inventory
set updated_at = created_at
where updated_at is null;

alter table parts_inventory
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table employees
  drop constraint if exists employees_company_role_check;

alter table employees
  add constraint employees_company_role_check
  check (company_role in ('company_super_user', 'platform_admin'));
