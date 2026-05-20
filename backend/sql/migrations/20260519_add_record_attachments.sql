alter table work_orders
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table equipment
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table parts_inventory
  add column if not exists attachments jsonb not null default '[]'::jsonb;
