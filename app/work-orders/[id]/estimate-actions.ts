"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const allowedRoles = ["owner", "admin", "manager", "service_advisor"] as const;

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function canManage(role: string | null) {
  return allowedRoles.includes(role as (typeof allowedRoles)[number]);
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
    .select("organization_id,role")
    .eq("id", auth.claims.sub)
    .maybeSingle();

  if (!profile?.organization_id) redirect("/dashboard");

  return {
    supabase,
    userId: auth.claims.sub,
    organizationId: profile.organization_id,
    role: String(profile.role),
  };
}

async function loadOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  workOrderId: string,
) {
  const { data } = await supabase
    .from("work_orders")
    .select("id,number")
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) redirect("/work-orders");
  return data;
}

async function event(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  estimateId: string,
  eventType: "created" | "sent" | "approved" | "rejected" | "expired" | "cancelled",
  actorId: string,
) {
  await supabase.from("estimate_events").insert({
    organization_id: organizationId,
    estimate_id: estimateId,
    event_type: eventType,
    actor_id: actorId,
  });
}

export async function createEstimate(formData: FormData) {
  const { supabase, userId, organizationId, role } = await context();
  if (!canManage(role)) redirect("/work-orders");

  const workOrderId = clean(formData.get("work_order_id"));
  await loadOrder(supabase, organizationId, workOrderId);

  const { data: items } = await supabase
    .from("work_order_items")
    .select("id,item_type,description,quantity,unit_price,cost_price,tax_rate")
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (!items?.length) {
    redirect(`/work-orders/${workOrderId}?error=estimate_no_items`);
  }

  const validUntil = clean(formData.get("valid_until")) || null;
  const customerNote = clean(formData.get("customer_note")) || null;

  let subtotal = 0;
  let taxTotal = 0;

  const snapshot = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const taxRate = Number(item.tax_rate);
    const lineNet = roundMoney(quantity * unitPrice);
    const lineTax = roundMoney(lineNet * taxRate / 100);
    const lineTotal = roundMoney(lineNet + lineTax);

    subtotal += lineNet;
    taxTotal += lineTax;

    return {
      source_work_order_item_id: item.id,
      item_type: item.item_type,
      description: item.description,
      quantity,
      unit_price: unitPrice,
      cost_price: Number(item.cost_price ?? 0),
      tax_rate: taxRate,
      line_net: lineNet,
      line_tax: lineTax,
      line_total: lineTotal,
    };
  });

  const { data: estimate, error } = await supabase
    .from("estimates")
    .insert({
      organization_id: organizationId,
      work_order_id: workOrderId,
      status: "draft",
      valid_until: validUntil,
      subtotal: roundMoney(subtotal),
      tax_total: roundMoney(taxTotal),
      total: roundMoney(subtotal + taxTotal),
      customer_note: customerNote,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !estimate) {
    redirect(`/work-orders/${workOrderId}?error=estimate_failed`);
  }

  const { error: itemError } = await supabase.from("estimate_items").insert(
    snapshot.map((item) => ({
      organization_id: organizationId,
      estimate_id: estimate.id,
      ...item,
    })),
  );

  if (itemError) {
    await supabase.from("estimates").delete().eq("id", estimate.id).eq("organization_id", organizationId);
    redirect(`/work-orders/${workOrderId}?error=estimate_failed`);
  }

  await event(supabase, organizationId, estimate.id, "created", userId);
  redirect(`/work-orders/${workOrderId}?saved=estimate`);
}

export async function updateEstimateStatus(formData: FormData) {
  const { supabase, userId, organizationId, role } = await context();
  if (!canManage(role)) redirect("/work-orders");

  const workOrderId = clean(formData.get("work_order_id"));
  const estimateId = clean(formData.get("estimate_id"));
  const next = clean(formData.get("status"));
  await loadOrder(supabase, organizationId, workOrderId);

  const allowed: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["approved", "rejected", "expired"],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };

  const { data: estimate } = await supabase
    .from("estimates")
    .select("id,status")
    .eq("id", estimateId)
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!estimate || !(allowed[estimate.status] ?? []).includes(next)) {
    redirect(`/work-orders/${workOrderId}?error=estimate_transition`);
  }

  const now = new Date().toISOString();
  const patch: Record<string, string> = { status: next };

  if (next === "sent") patch.sent_at = now;
  if (next === "approved") patch.approved_at = now;
  if (next === "rejected") patch.rejected_at = now;

  const { error } = await supabase
    .from("estimates")
    .update(patch)
    .eq("id", estimateId)
    .eq("work_order_id", workOrderId)
    .eq("organization_id", organizationId);

  if (error) redirect(`/work-orders/${workOrderId}?error=estimate_transition`);

  if (next === "approved") {
    await supabase
      .from("work_orders")
      .update({ customer_approval: "approved" })
      .eq("id", workOrderId)
      .eq("organization_id", organizationId);
  }

  if (next === "rejected") {
    await supabase
      .from("work_orders")
      .update({ customer_approval: "rejected" })
      .eq("id", workOrderId)
      .eq("organization_id", organizationId);
  }

  await event(
    supabase,
    organizationId,
    estimateId,
    next as "sent" | "approved" | "rejected" | "expired" | "cancelled",
    userId,
  );

  redirect(`/work-orders/${workOrderId}?saved=estimate`);
}
