begin;

create table if not exists employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  clock_in_note text,
  clock_out_note text,
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create index if not exists idx_employee_time_entries_course_id_clock_in_at on employee_time_entries (course_id, clock_in_at desc);
create index if not exists idx_employee_time_entries_employee_id_clock_in_at on employee_time_entries (employee_id, clock_in_at desc);
create unique index if not exists idx_employee_time_entries_open_shift on employee_time_entries (employee_id, course_id) where clock_out_at is null;

commit;
