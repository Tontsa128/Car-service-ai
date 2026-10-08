-- Workflow integrity: enforce customer/vehicle relationships and secure role helpers.

create or replace function public.current_user_org_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles
  where id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles
  where id = auth.uid() and active = true
  limit 1;
$$;

revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.validate_customer_vehicle_relationship()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  vehicle_customer uuid;
  vehicle_org uuid;
  customer_org uuid;
begin
  select organization_id, customer_id into vehicle_org, vehicle_customer
  from public.vehicles where id = new.vehicle_id;

  select organization_id into customer_org
  from public.customers where id = new.customer_id;

  if vehicle_org is null or customer_org is null
     or vehicle_org <> new.organization_id
     or customer_org <> new.organization_id
     or vehicle_customer <> new.customer_id then
    raise exception 'Customer and vehicle must belong to the same organization and vehicle customer';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_customer_vehicle_integrity on public.appointments;
create trigger appointments_customer_vehicle_integrity
before insert or update of customer_id, vehicle_id, organization_id on public.appointments
for each row execute function public.validate_customer_vehicle_relationship();

drop trigger if exists work_orders_customer_vehicle_integrity on public.work_orders;
create trigger work_orders_customer_vehicle_integrity
before insert or update of customer_id, vehicle_id, organization_id on public.work_orders
for each row execute function public.validate_customer_vehicle_relationship();

create index if not exists work_orders_org_created_idx
  on public.work_orders(organization_id, created_at desc);
create index if not exists work_orders_org_customer_idx
  on public.work_orders(organization_id, customer_id);
create index if not exists work_orders_org_vehicle_idx
  on public.work_orders(organization_id, vehicle_id);
create index if not exists inspection_items_inspection_idx
  on public.inspection_items(inspection_id, category);
create index if not exists work_order_status_history_order_idx
  on public.work_order_status_history(work_order_id, created_at desc);
