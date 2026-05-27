-- Notifications: in-app history + push token registry + user preferences

create table if not exists notification_preferences (
  employee_id uuid primary key references employees(id) on delete cascade,
  notifications_enabled boolean not null default true,
  assignment_notifications_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_device_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  provider text not null default 'onesignal',
  device_token text not null,
  device_type text not null default 'web',
  app_version text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(employee_id, provider, device_token)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  facility_id uuid references facilities(id) on delete set null,
  work_order_id uuid references work_orders(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  deep_link text,
  assigned_by_employee_id uuid references employees(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_employee_created_at on notifications(employee_id, created_at desc);
create index if not exists idx_notifications_employee_unread on notifications(employee_id, read_at) where read_at is null;
create index if not exists idx_notification_tokens_employee on notification_device_tokens(employee_id, last_seen_at desc);
