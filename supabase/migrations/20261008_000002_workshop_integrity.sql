-- Operational integrity and DVI foundations.

create index if not exists customers_org_name_idx on public.customers(organization_id,last_name,first_name);
create index if not exists vehicles_org_customer_idx on public.vehicles(organization_id,customer_id);

create unique index if not exists vehicles_org_registration_unique_idx
  on public.vehicles(organization_id, lower(registration_number))
  where registration_number is not null and registration_number <> '';

create unique index if not exists vehicles_org_vin_unique_idx
  on public.vehicles(organization_id, upper(vin))
  where vin is not null and vin <> '';

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  category text not null,
  item_key text not null,
  label text not null,
  result text not null default 'not_checked' check (result in ('not_checked','ok','attention','critical','not_applicable')),
  notes text,
  measurement text,
  created_at timestamptz not null default now()
);

create index inspection_items_inspection_idx on public.inspection_items(inspection_id);

create table public.work_order_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  from_status public.work_order_status,
  to_status public.work_order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index work_order_status_history_order_idx on public.work_order_status_history(work_order_id,created_at desc);
create index work_order_status_history_org_idx on public.work_order_status_history(organization_id,created_at desc);

create or replace function public.validate_same_organization()
returns trigger language plpgsql security invoker set search_path=public as $$
declare related_org uuid;
begin
  if tg_table_name='vehicles' then
    select organization_id into related_org from public.customers where id=new.customer_id;
  elsif tg_table_name='appointments' then
    select organization_id into related_org from public.customers where id=new.customer_id;
  elsif tg_table_name='work_orders' then
    select organization_id into related_org from public.customers where id=new.customer_id;
  elsif tg_table_name='work_order_items' then
    select organization_id into related_org from public.work_orders where id=new.work_order_id;
  elsif tg_table_name='inspections' then
    select organization_id into related_org from public.work_orders where id=new.work_order_id;
  elsif tg_table_name='inspection_items' then
    select organization_id into related_org from public.inspections where id=new.inspection_id;
  elsif tg_table_name='work_order_status_history' then
    select organization_id into related_org from public.work_orders where id=new.work_order_id;
  end if;

  if related_org is null or related_org<>new.organization_id then
    raise exception 'Related record must belong to the same organization';
  end if;

  if tg_table_name in ('appointments','work_orders') then
    if tg_table_name='appointments' then
      select organization_id into related_org from public.vehicles where id=new.vehicle_id;
    else
      select organization_id into related_org from public.vehicles where id=new.vehicle_id;
    end if;
    if related_org is null or related_org<>new.organization_id then
      raise exception 'Vehicle must belong to the same organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_same_org before insert or update on public.vehicles for each row execute function public.validate_same_organization();
create trigger appointments_same_org before insert or update on public.appointments for each row execute function public.validate_same_organization();
create trigger work_orders_same_org before insert or update on public.work_orders for each row execute function public.validate_same_organization();
create trigger work_order_items_same_org before insert or update on public.work_order_items for each row execute function public.validate_same_organization();
create trigger inspections_same_org before insert or update on public.inspections for each row execute function public.validate_same_organization();
create trigger inspection_items_same_org before insert or update on public.inspection_items for each row execute function public.validate_same_organization();
create trigger work_order_status_history_same_org before insert or update on public.work_order_status_history for each row execute function public.validate_same_organization();

alter table public.inspection_items enable row level security;
alter table public.work_order_status_history enable row level security;

create policy "members can read inspection items in organization" on public.inspection_items for select using (organization_id=public.current_user_org_id());
create policy "members can write inspection items in organization" on public.inspection_items for all using (organization_id=public.current_user_org_id()) with check (organization_id=public.current_user_org_id());
create policy "members can read work order status history in organization" on public.work_order_status_history for select using (organization_id=public.current_user_org_id());
create policy "members can insert work order status history in organization" on public.work_order_status_history for insert with check (organization_id=public.current_user_org_id());

grant select,insert,update,delete on public.inspection_items to authenticated;
grant select,insert on public.work_order_status_history to authenticated;
