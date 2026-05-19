create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete restrict,
  email text not null unique,
  full_name text,
  password_hash text,
  must_change_password boolean not null default false,
  hourly_rate numeric(10,2),
  profile_image_url text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  company_role text check (company_role in ('company_super_user')),
  token_version integer not null default 0,
  created_at timestamptz not null default now()
);

alter table employees add column if not exists must_change_password boolean not null default false;
alter table employees add column if not exists hourly_rate numeric(10,2);
alter table employees add column if not exists profile_image_url text;
alter table employees add column if not exists phone text;
alter table employees add column if not exists address_line_1 text;
alter table employees add column if not exists address_line_2 text;
alter table employees add column if not exists city text;
alter table employees add column if not exists state text;
alter table employees add column if not exists postal_code text;
alter table employees add column if not exists company_role text check (company_role in ('company_super_user'));
alter table employees add column if not exists token_version integer not null default 0;

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete restrict,
  name text not null,
  region text,
  superintendent_name text,
  course_areas_config jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table employees add column if not exists company_id uuid references companies (id) on delete restrict;
alter table courses add column if not exists company_id uuid references companies (id) on delete restrict;
alter table courses add column if not exists course_areas_config jsonb not null default '[]'::jsonb;

create table if not exists course_memberships (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  role text not null check (role in ('admin', 'read_write', 'read_only')),
  created_at timestamptz not null default now(),
  unique (employee_id, course_id)
);

create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'Open',
  assignee text,
  technician_employee_id uuid references employees (id) on delete set null,
  technician_name text,
  labor_hours numeric(10,2),
  labor_rate numeric(10,2),
  labor_cost numeric(10,2),
  parts_cost numeric(10,2),
  total_cost numeric(10,2),
  completed_work_notes text,
  completed_at timestamptz,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table work_orders add column if not exists technician_employee_id uuid references employees (id) on delete set null;
alter table work_orders add column if not exists technician_name text;
alter table work_orders add column if not exists labor_hours numeric(10,2);
alter table work_orders add column if not exists labor_rate numeric(10,2);
alter table work_orders add column if not exists labor_cost numeric(10,2);
alter table work_orders add column if not exists parts_cost numeric(10,2);
alter table work_orders add column if not exists total_cost numeric(10,2);
alter table work_orders add column if not exists completed_work_notes text;
alter table work_orders add column if not exists completed_at timestamptz;
alter table work_orders add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table work_orders add column if not exists updated_at timestamptz not null default now();

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  name text not null,
  make text,
  model text,
  assigned_area text,
  vin text,
  serial_number text,
  description text,
  hours text,
  detail text,
  status text not null default 'Scheduled',
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table equipment add column if not exists make text;
alter table equipment add column if not exists model text;
alter table equipment add column if not exists assigned_area text;
alter table equipment add column if not exists vin text;
alter table equipment add column if not exists serial_number text;
alter table equipment add column if not exists description text;
alter table equipment add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table equipment add column if not exists updated_at timestamptz not null default now();

create table if not exists field_logs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  area text not null,
  category text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid references employees (id) on delete set null,
  action text not null,
  course_id uuid references courses (id) on delete set null,
  target_employee_id uuid references employees (id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table if not exists invite_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  token_hash text not null unique,
  created_by_employee_id uuid references employees (id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  clock_in_note text,
  clock_out_note text,
  clock_in_latitude numeric(9,6),
  clock_in_longitude numeric(9,6),
  clock_out_latitude numeric(9,6),
  clock_out_longitude numeric(9,6),
  approved_at timestamptz,
  approved_by_employee_id uuid references employees (id) on delete set null,
  approval_note text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);

alter table employee_time_entries add column if not exists clock_in_latitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_in_longitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_out_latitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_out_longitude numeric(9,6);
alter table employee_time_entries add column if not exists approved_at timestamptz;
alter table employee_time_entries add column if not exists approved_by_employee_id uuid references employees (id) on delete set null;
alter table employee_time_entries add column if not exists approval_note text;
alter table employee_time_entries add column if not exists updated_at timestamptz not null default now();

create table if not exists parts_inventory (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  sku text not null,
  part_description text not null,
  quantity_on_hand numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  reorder_url text,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, sku)
);

alter table parts_inventory add column if not exists image_urls jsonb not null default '[]'::jsonb;

create table if not exists work_order_parts_usage (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  part_inventory_id uuid not null references parts_inventory (id) on delete restrict,
  quantity_used numeric(10,2) not null,
  unit_cost numeric(10,2) not null default 0,
  total_cost numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists work_order_activity (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  actor_employee_id uuid references employees (id) on delete set null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'commented')),
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_company_id on employees (company_id);
create index if not exists idx_employees_company_role on employees (company_role);
create index if not exists idx_courses_company_id on courses (company_id);
create index if not exists idx_course_memberships_course_id on course_memberships (course_id);
create index if not exists idx_work_orders_course_id on work_orders (course_id);
create index if not exists idx_equipment_course_id on equipment (course_id);
create index if not exists idx_audit_logs_course_id_created_at on audit_logs (course_id, created_at desc);
create index if not exists idx_invite_tokens_employee_id on invite_tokens (employee_id);
create index if not exists idx_invite_tokens_expires_at on invite_tokens (expires_at);
create index if not exists idx_parts_inventory_course_id on parts_inventory (course_id);
create index if not exists idx_work_order_parts_usage_work_order_id on work_order_parts_usage (work_order_id);
create index if not exists idx_work_order_activity_work_order_id_created_at on work_order_activity (work_order_id, created_at desc);
create index if not exists idx_work_order_activity_course_id_created_at on work_order_activity (course_id, created_at desc);
create index if not exists idx_employee_time_entries_course_id_clock_in_at on employee_time_entries (course_id, clock_in_at desc);
create index if not exists idx_employee_time_entries_employee_id_clock_in_at on employee_time_entries (employee_id, clock_in_at desc);
create unique index if not exists idx_employee_time_entries_open_shift on employee_time_entries (employee_id, course_id) where clock_out_at is null;
