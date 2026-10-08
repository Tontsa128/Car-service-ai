-- Car Service AI: initial multi-tenant workshop schema
-- Security principle: every business record is scoped to organization_id and protected by RLS.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'manager', 'service_advisor', 'technician', 'accounting', 'viewer');
create type public.customer_type as enum ('person', 'company');
create type public.appointment_status as enum ('requested', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show');
create type public.work_order_status as enum ('draft', 'awaiting_approval', 'approved', 'in_progress', 'quality_check', 'ready', 'invoiced', 'closed', 'cancelled');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'expired');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_id text,
  timezone text not null default 'Europe/Helsinki',
  default_language text not null default 'fi' check (default_language in ('fi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text,
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.customer_type not null default 'person',
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  registration_number text,
  vin text,
  make text,
  model text,
  model_year integer,
  odometer_km integer,
  engine text,
  fuel_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.appointment_status not null default 'requested',
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  number bigint generated always as identity unique,
  status public.work_order_status not null default 'draft',
  complaint text,
  diagnosis text,
  technician_notes text,
  internal_notes text,
  customer_approval public.approval_status not null default 'pending',
  estimated_total numeric(12,2),
  final_total numeric(12,2),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  item_type text not null check (item_type in ('labor', 'part', 'fee', 'discount')),
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  cost_price numeric(12,2),
  tax_rate numeric(5,2) not null default 25.5,
  created_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  result text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_org_idx on public.customers(organization_id);
create index vehicles_org_idx on public.vehicles(organization_id);
create index appointments_org_start_idx on public.appointments(organization_id, starts_at);
create index work_orders_org_status_idx on public.work_orders(organization_id, status);
create index work_order_items_order_idx on public.work_order_items(work_order_id);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and active = true limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.appointments enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_items enable row level security;
alter table public.inspections enable row level security;
alter table public.audit_logs enable row level security;

create policy "members can read own organization"
on public.organizations for select
using (id = public.current_user_org_id());

create policy "users can read their own profile"
on public.profiles for select
using (id = auth.uid());

create policy "members can read customers in organization"
on public.customers for select
using (organization_id = public.current_user_org_id());

create policy "members can write customers in organization"
on public.customers for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read vehicles in organization"
on public.vehicles for select
using (organization_id = public.current_user_org_id());

create policy "members can write vehicles in organization"
on public.vehicles for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read appointments in organization"
on public.appointments for select
using (organization_id = public.current_user_org_id());

create policy "members can write appointments in organization"
on public.appointments for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read work orders in organization"
on public.work_orders for select
using (organization_id = public.current_user_org_id());

create policy "members can write work orders in organization"
on public.work_orders for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read work order items in organization"
on public.work_order_items for select
using (organization_id = public.current_user_org_id());

create policy "members can write work order items in organization"
on public.work_order_items for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read inspections in organization"
on public.inspections for select
using (organization_id = public.current_user_org_id());

create policy "members can write inspections in organization"
on public.inspections for all
using (organization_id = public.current_user_org_id())
with check (organization_id = public.current_user_org_id());

create policy "members can read audit logs in organization"
on public.audit_logs for select
using (organization_id = public.current_user_org_id());

create policy "members can insert audit logs in organization"
on public.audit_logs for insert
with check (organization_id = public.current_user_org_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.customers,
  public.vehicles,
  public.appointments,
  public.work_orders,
  public.work_order_items,
  public.inspections,
  public.audit_logs
to authenticated;
grant select on public.organizations, public.profiles to authenticated;
