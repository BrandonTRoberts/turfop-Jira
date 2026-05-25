create table if not exists service_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists service_template_parts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references service_templates (id) on delete cascade,
  part_inventory_id uuid not null references parts_inventory (id) on delete cascade,
  quantity numeric(10,2) not null,
  created_at timestamptz not null default now()
);
