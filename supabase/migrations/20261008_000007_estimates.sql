-- Estimate / offer engine: immutable snapshots of work-order pricing with an append-only approval event trail.

create type public.estimate_status as enum (
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  number bigint generated always as identity unique,
  version integer not null default 1 check (version > 0),
  status public.estimate_status not null default 'draft',
  currency text not null default 'EUR' check (currency = 'EUR'),
  valid_until date,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  customer_note text,
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  source_work_order_item_id uuid references public.work_order_items(id) on delete set null,
  item_type text not null check (item_type in ('labor', 'part', 'fee', 'discount')),
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  tax_rate numeric(5,2) not null check (tax_rate >= 0 and tax_rate <= 100),
  line_net numeric(12,2) not null,
  line_tax numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table public.estimate_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  event_type text not null check (event_type in ('created','sent','approved','rejected','expired','cancelled')),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index estimates_org_work_order_idx on public.estimates(organization_id, work_order_id, created_at desc);
create index estimates_org_status_idx on public.estimates(organization_id, status);
create index estimate_items_estimate_idx on public.estimate_items(estimate_id, created_at);
create index estimate_events_estimate_idx on public.estimate_events(estimate_id, created_at desc);

create trigger estimates_updated_at
before update on public.estimates
for each row execute function public.set_updated_at();

alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.estimate_events enable row level security;

create policy "members can read estimates in organization"
on public.estimates for select
using (organization_id = public.current_user_org_id());

create policy "authorized members can create estimates"
on public.estimates for insert
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('owner','admin','manager','service_advisor')
);

create policy "authorized members can update estimates"
on public.estimates for update
using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('owner','admin','manager','service_advisor')
)
with check (organization_id = public.current_user_org_id());

create policy "managers can delete draft estimates"
on public.estimates for delete
using (
  organization_id = public.current_user_org_id()
  and status = 'draft'
  and public.current_user_role() in ('owner','admin','manager')
);

create policy "members can read estimate items"
on public.estimate_items for select
using (organization_id = public.current_user_org_id());

create policy "authorized members can create estimate items"
on public.estimate_items for insert
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('owner','admin','manager','service_advisor')
);

create policy "authorized members can read estimate events"
on public.estimate_events for select
using (organization_id = public.current_user_org_id());

create policy "authorized members can append estimate events"
on public.estimate_events for insert
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('owner','admin','manager','service_advisor')
);

grant select, insert, update, delete on public.estimates to authenticated;
grant select, insert on public.estimate_items to authenticated;
grant select, insert on public.estimate_events to authenticated;
