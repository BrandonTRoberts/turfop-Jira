alter table work_orders
  add column if not exists equipment_id uuid references equipment (id) on delete set null,
  add column if not exists due_at timestamptz;

create index if not exists idx_work_orders_equipment_id
  on work_orders (equipment_id);
