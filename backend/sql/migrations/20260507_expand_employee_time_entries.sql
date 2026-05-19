begin;

alter table employee_time_entries add column if not exists clock_in_latitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_in_longitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_out_latitude numeric(9,6);
alter table employee_time_entries add column if not exists clock_out_longitude numeric(9,6);
alter table employee_time_entries add column if not exists approved_at timestamptz;
alter table employee_time_entries add column if not exists approved_by_employee_id uuid references employees (id) on delete set null;
alter table employee_time_entries add column if not exists approval_note text;
alter table employee_time_entries add column if not exists updated_at timestamptz not null default now();

commit;
