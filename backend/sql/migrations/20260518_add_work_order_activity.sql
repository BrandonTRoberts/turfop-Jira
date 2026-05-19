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

create index if not exists idx_work_order_activity_work_order_id_created_at
  on work_order_activity (work_order_id, created_at desc);

create index if not exists idx_work_order_activity_course_id_created_at
  on work_order_activity (course_id, created_at desc);
