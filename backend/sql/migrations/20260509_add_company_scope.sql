create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table employees add column if not exists company_id uuid references companies (id) on delete set null;
alter table employees add column if not exists company_role text check (company_role in ('company_super_user'));

alter table courses add column if not exists company_id uuid references companies (id) on delete set null;

with default_company as (
  insert into companies (name)
  select 'Default Company'
  where not exists (select 1 from companies)
  returning id
),
resolved_company as (
  select id from default_company
  union all
  select id from companies order by created_at asc limit 1
)
update employees
set company_id = (select id from resolved_company limit 1)
where company_id is null;

with resolved_company as (
  select id from companies order by created_at asc limit 1
)
update courses
set company_id = (select id from resolved_company limit 1)
where company_id is null;

alter table employees alter column company_id set not null;
alter table courses alter column company_id set not null;

create index if not exists idx_employees_company_id on employees (company_id);
create index if not exists idx_courses_company_id on courses (company_id);
create index if not exists idx_employees_company_role on employees (company_role);
