-- Work-order assignment and workflow integrity.

alter table public.work_orders
  add column if not exists technician_id uuid references public.profiles(id) on delete set null;

create index if not exists work_orders_org_technician_idx
  on public.work_orders(organization_id, technician_id);

create or replace function public.validate_work_order_technician()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare technician_org uuid;
begin
  if new.technician_id is null then
    return new;
  end if;

  select organization_id into technician_org
  from public.profiles
  where id = new.technician_id and active = true;

  if technician_org is null or technician_org <> new.organization_id then
    raise exception 'Technician must belong to the same organization';
  end if;

  return new;
end;
$$;

create trigger work_orders_same_org_technician
before insert or update of technician_id on public.work_orders
for each row execute function public.validate_work_order_technician();
