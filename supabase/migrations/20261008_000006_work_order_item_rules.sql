-- Commercial line-item integrity: keep pricing rows valid in the database as well as in server actions.

alter table public.work_order_items
  drop constraint if exists work_order_items_quantity_positive,
  drop constraint if exists work_order_items_tax_rate_valid,
  drop constraint if exists work_order_items_cost_nonnegative,
  drop constraint if exists work_order_items_price_by_type;

alter table public.work_order_items
  add constraint work_order_items_quantity_positive
    check (quantity > 0),
  add constraint work_order_items_tax_rate_valid
    check (tax_rate >= 0 and tax_rate <= 100),
  add constraint work_order_items_cost_nonnegative
    check (cost_price is null or cost_price >= 0),
  add constraint work_order_items_price_by_type
    check (
      (item_type = 'discount' and unit_price <= 0)
      or
      (item_type <> 'discount' and unit_price >= 0)
    );

create index if not exists work_order_items_org_order_created_idx
  on public.work_order_items(organization_id, work_order_id, created_at);
