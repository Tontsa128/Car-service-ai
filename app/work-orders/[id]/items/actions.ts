"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const editableRoles = [
  "owner",
  "admin",
  "manager",
  "service_advisor",
  "technician",
] as const;

const itemTypes = ["labor", "part", "fee", "discount"] as const;

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function canEdit(role: string | null) {
  return editableRoles.includes(role as (typeof editableRoles)[number]);
}

function parseMoney(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseQuantity(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "1").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function context() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", auth.claims.sub)
    .maybeSingle();

  if (!profile?.organization_id) redirect("/dashboard");

  return {
    supabase,
    organizationId: profile.organization_id,
    role: String(profile.role),
  };
}

async function loadOrder(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, id: string) {
  const { data } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) redirect("/work-orders");
  return data;
}

async function recalculateEstimate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  workOrderId: string,
) {
  const { data: items } = await supabase
    .from("work_order_items")
    .select("quantity,unit_price,tax_rate,cost_price")
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId);

  let net = 0;
  let tax = 0;
  let cost = 0;

  for (const item of items ?? []) {
    const lineNet = Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
    net += lineNet;
    tax += lineNet * (Number(item.tax_rate ?? 0) / 100);
    cost += Number(item.quantity ?? 0) * Number(item.cost_price ?? 0);
  }

  const gross = net + tax;

  const { error } = await supabase
    .from("work_orders")
    .update({
      estimated_total: roundMoney(gross),
    })
    .eq("id", workOrderId)
    .eq("organization_id", organizationId);

  return {
    net: roundMoney(net),
    tax: roundMoney(tax),
    gross: roundMoney(gross),
    cost: roundMoney(cost),
    margin: roundMoney(net - cost),
    error,
  };
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: (await supabase.auth.getClaims()).data.claims?.sub ?? null,
    action,
    entity_type: "work_order_item",
    entity_id: entityId,
    metadata,
  });
}

export async function addWorkOrderItem(formData: FormData) {
  const { supabase, organizationId, role } = await context();
  if (!canEdit(role)) redirect("/work-orders");

  const workOrderId = clean(formData.get("work_order_id"));
  await loadOrder(supabase, organizationId, workOrderId);

  const itemType = clean(formData.get("item_type"));
  const description = clean(formData.get("description"));
  const quantity = parseQuantity(formData.get("quantity"));
  const rawUnitPrice = parseMoney(formData.get("unit_price"));
  const costPrice = parseMoney(formData.get("cost_price"), 0);
  const taxRate = parseMoney(formData.get("tax_rate"), 25.5);

  if (!workOrderId || !itemTypes.includes(itemType as (typeof itemTypes)[number]) || !description || !quantity) {
    redirect(`/work-orders/${workOrderId}?error=item_invalid`);
  }

  if (taxRate < 0 || taxRate > 100 || costPrice < 0) {
    redirect(`/work-orders/${workOrderId}?error=item_invalid`);
  }

  const unitPrice = itemType === "discount" ? -Math.abs(rawUnitPrice) : Math.max(rawUnitPrice, 0);

  const { data: item, error } = await supabase
    .from("work_order_items")
    .insert({
      organization_id: organizationId,
      work_order_id: workOrderId,
      item_type: itemType,
      description,
      quantity,
      unit_price: unitPrice,
      cost_price,
      tax_rate: taxRate,
    })
    .select("id")
    .single();

  if (error || !item) redirect(`/work-orders/${workOrderId}?error=item_failed`);

  await recalculateEstimate(supabase, organizationId, workOrderId);
  await audit(supabase, organizationId, "work_order_item.created", item.id, {
    work_order_id: workOrderId,
    item_type: itemType,
  });

  redirect(`/work-orders/${workOrderId}?saved=item`);
}

export async function updateWorkOrderItem(formData: FormData) {
  const { supabase, organizationId, role } = await context();
  if (!canEdit(role)) redirect("/work-orders");

  const workOrderId = clean(formData.get("work_order_id"));
  const itemId = clean(formData.get("item_id"));
  await loadOrder(supabase, organizationId, workOrderId);

  const itemType = clean(formData.get("item_type"));
  const description = clean(formData.get("description"));
  const quantity = parseQuantity(formData.get("quantity"));
  const rawUnitPrice = parseMoney(formData.get("unit_price"));
  const costPrice = parseMoney(formData.get("cost_price"), 0);
  const taxRate = parseMoney(formData.get("tax_rate"), 25.5);

  if (!itemId || !itemTypes.includes(itemType as (typeof itemTypes)[number]) || !description || !quantity) {
    redirect(`/work-orders/${workOrderId}?error=item_invalid`);
  }

  const unitPrice = itemType === "discount" ? -Math.abs(rawUnitPrice) : Math.max(rawUnitPrice, 0);

  const { data: item, error } = await supabase
    .from("work_order_items")
    .update({
      item_type: itemType,
      description,
      quantity,
      unit_price: unitPrice,
      cost_price,
      tax_rate: taxRate,
    })
    .eq("id", itemId)
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !item) redirect(`/work-orders/${workOrderId}?error=item_failed`);

  await recalculateEstimate(supabase, organizationId, workOrderId);
  await audit(supabase, organizationId, "work_order_item.updated", item.id, {
    work_order_id: workOrderId,
    item_type: itemType,
  });

  redirect(`/work-orders/${workOrderId}?saved=item`);
}

export async function deleteWorkOrderItem(formData: FormData) {
  const { supabase, organizationId, role } = await context();
  if (!canEdit(role)) redirect("/work-orders");

  const workOrderId = clean(formData.get("work_order_id"));
  const itemId = clean(formData.get("item_id"));
  await loadOrder(supabase, organizationId, workOrderId);

  if (!itemId) redirect(`/work-orders/${workOrderId}?error=item_invalid`);

  const { error } = await supabase
    .from("work_order_items")
    .delete()
    .eq("id", itemId)
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId);

  if (error) redirect(`/work-orders/${workOrderId}?error=item_failed`);

  await recalculateEstimate(supabase, organizationId, workOrderId);

  redirect(`/work-orders/${workOrderId}?saved=item`);
}
