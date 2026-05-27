-- Multi-facility templates, locations, and clock approval audit

create table if not exists facility_locations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  name text not null,
  location_type text not null default 'section',
  notes text,
  is_archived boolean not null default false,
  created_by_employee_id uuid references employees(id) on delete set null,
  updated_by_employee_id uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(facility_id, name)
);

alter table service_templates add column if not exists company_id uuid references companies(id) on delete cascade;
alter table service_templates add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table service_templates add column if not exists required_tools jsonb not null default '[]'::jsonb;
alter table service_templates add column if not exists estimated_labor_hours numeric(10,2);
alter table service_templates add column if not exists location_ids jsonb not null default '[]'::jsonb;
alter table service_templates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table service_templates add column if not exists archived_at timestamptz;
alter table service_templates add column if not exists archived_by_employee_id uuid references employees(id) on delete set null;

update service_templates st
set company_id = f.company_id
from facilities f
where st.facility_id = f.id and st.company_id is null;

create table if not exists service_template_equipment (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references service_templates(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete set null,
  equipment_name text not null,
  quantity numeric(10,2) not null default 1,
  created_at timestamptz not null default now()
);

alter table work_orders add column if not exists template_id uuid references service_templates(id) on delete set null;
alter table work_orders add column if not exists location_id uuid references facility_locations(id) on delete set null;
alter table work_orders add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table work_orders add column if not exists required_tools jsonb not null default '[]'::jsonb;
alter table work_orders add column if not exists estimated_labor_hours numeric(10,2);

create table if not exists employee_time_entry_edits (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references employee_time_entries(id) on delete cascade,
  edited_by_employee_id uuid references employees(id) on delete set null,
  edit_action text not null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  edit_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_facility_locations_facility_id on facility_locations(facility_id);
create index if not exists idx_service_templates_company_id on service_templates(company_id);
create index if not exists idx_work_orders_template_id on work_orders(template_id);
create index if not exists idx_employee_time_entry_edits_entry_id on employee_time_entry_edits(time_entry_id, created_at desc);
