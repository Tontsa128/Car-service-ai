-- Role-aware authorization and automatic work-order status history.

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and active=true limit 1;
$$;

create or replace function public.record_work_order_status_change()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status is distinct from old.status then
    insert into public.work_order_status_history(organization_id,work_order_id,from_status,to_status,changed_by)
    values(new.organization_id,new.id,old.status,new.status,auth.uid());
  end if;
  return new;
end;
$$;

create trigger work_orders_status_history
after update of status on public.work_orders
for each row execute function public.record_work_order_status_change();

drop policy if exists "members can write customers in organization" on public.customers;
drop policy if exists "members can write vehicles in organization" on public.vehicles;
drop policy if exists "members can write appointments in organization" on public.appointments;
drop policy if exists "members can write work orders in organization" on public.work_orders;
drop policy if exists "members can write work order items in organization" on public.work_order_items;
drop policy if exists "members can write inspections in organization" on public.inspections;
drop policy if exists "members can write inspection items in organization" on public.inspection_items;

create policy "authorized staff can write customers" on public.customers for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can update customers" on public.customers for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can delete customers" on public.customers for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));

create policy "authorized staff can write vehicles" on public.vehicles for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can update vehicles" on public.vehicles for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can delete vehicles" on public.vehicles for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));

create policy "authorized staff can write appointments" on public.appointments for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can update appointments" on public.appointments for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff can delete appointments" on public.appointments for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));

create policy "authorized staff can write work orders" on public.work_orders for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor'));
create policy "authorized staff and technicians can update work orders" on public.work_orders for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "managers can delete work orders" on public.work_orders for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));

create policy "authorized staff can write work order items" on public.work_order_items for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "authorized staff can update work order items" on public.work_order_items for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "managers can delete work order items" on public.work_order_items for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));

create policy "authorized staff can write inspections" on public.inspections for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "authorized staff can update inspections" on public.inspections for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "managers can delete inspections" on public.inspections for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));

create policy "authorized staff can write inspection items" on public.inspection_items for insert
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "authorized staff can update inspection items" on public.inspection_items for update
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'))
with check(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager','service_advisor','technician'));
create policy "managers can delete inspection items" on public.inspection_items for delete
using(organization_id=public.current_user_org_id() and public.current_user_role() in('owner','admin','manager'));
