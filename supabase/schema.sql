-- TurfOps initial schema
-- Multi-course, role-aware structure for web + iOS + Android

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  region text,
  superintendent_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.course_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  role text not null check (role in ('admin', 'read_write', 'read_only')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'Open',
  assignee text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  hours text,
  detail text,
  status text not null default 'Scheduled',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.field_logs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  area text not null,
  category text not null,
  note text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Helper function to get the tenant_id from a course_id
create or replace function private.tenant_id_from_course(target_course_id uuid)
returns uuid
language sql
stable
as $$
  select tenant_id from public.courses where id = target_course_id limit 1;
$$;

create or replace function public.can_write_tenant(target_tenant_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = auth.uid()
      and tenant_id = target_tenant_id
      and role in ('owner', 'admin')
  );
$$;


-- Helper function to check if the user is a member of the tenant associated with a course
create or replace function public.is_tenant_member_from_course(target_course_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = auth.uid()
      and tenant_id = private.tenant_id_from_course(target_course_id)
  );
$$;

create or replace function public.current_course_role(target_course_id uuid)
returns text
language sql
stable
as $$
  select role
  from public.course_memberships
  where user_id = auth.uid() and course_id = target_course_id
  limit 1;
$$;

create or replace function public.can_read_course(target_course_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.course_memberships
    where user_id = auth.uid()
      and course_id = target_course_id
      and role in ('admin', 'read_write', 'read_only')
  );
$$;

create or replace function public.can_write_course(target_course_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.course_memberships
    where user_id = auth.uid()
      and course_id = target_course_id
      and role in ('admin', 'read_write')
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_memberships enable row level security;
alter table public.work_orders enable row level security;
alter table public.equipment enable row level security;
alter table public.field_logs enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;


create policy "profiles can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Tenant policies
create policy "users can read tenants they belong to"
  on public.tenants for select
  using (
    exists (
      select 1 from public.tenant_memberships
      where tenant_memberships.tenant_id = tenants.id
      and tenant_memberships.user_id = auth.uid()
    )
  );

create policy "users can read their own memberships"
  on public.tenant_memberships for select
  using (auth.uid() = user_id);


create policy "users can read their memberships"
  on public.course_memberships for select
  using (auth.uid() = user_id);

create policy "users can read allowed courses"
  on public.courses for select
  using (
    exists (
      select 1
      from public.tenant_memberships m
      where m.tenant_id = courses.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy "users can read course work orders"
  on public.work_orders for select
  using (public.is_tenant_member_from_course(course_id));

create policy "users can write course work orders"
  on public.work_orders for insert
  with check (can_write_tenant(private.tenant_id_from_course(course_id)));

create policy "users can update course work orders"
  on public.work_orders for update
  using (can_write_tenant(private.tenant_id_from_course(course_id)));

create policy "users can read equipment"
  on public.equipment for select
  using (public.is_tenant_member_from_course(course_id));

create policy "users can write equipment"
  on public.equipment for insert
  with check (can_write_tenant(private.tenant_id_from_course(course_id)));

create policy "users can update equipment"
  on public.equipment for update
  using (can_write_tenant(private.tenant_id_from_course(course_id)));

create policy "users can read field logs"
  on public.field_logs for select
  using (public.is_tenant_member_from_course(course_id));

create policy "users can write field logs"
  on public.field_logs for insert
  with check (can_write_tenant(private.tenant_id_from_course(course_id)));

create policy "users can update field logs"
  on public.field_logs for update
  using (can_write_tenant(private.tenant_id_from_course(course_id)));

create function public.get_user_tenants()
returns table (
  id uuid,
  name text,
  role text
)
language sql
security definer
as $$
  select
    t.id,
    t.name,
    tm.role
  from
    public.tenants t
  join
    public.tenant_memberships tm on t.id = tm.tenant_id
  where
    tm.user_id = auth.uid();
$$;
