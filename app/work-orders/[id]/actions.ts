"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const transitions: Record<string, string[]> = {
  draft: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["quality_check", "cancelled"],
  quality_check: ["ready", "in_progress"],
  ready: ["invoiced", "in_progress"],
  invoiced: ["closed"],
  closed: [],
  cancelled: [],
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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
  return { supabase, userId: auth.claims.sub, organizationId: profile.organization_id };
}

async function loadOrderId(formData: FormData) {
  const id = clean(formData.get("work_order_id"));
  if (!id) redirect("/work-orders");
  return id;
}

export async function updateWorkOrderStatus(formData: FormData) {
  const { supabase, organizationId } = await context();
  const id = await loadOrderId(formData);
  const next = clean(formData.get("status"));

  const { data: order } = await supabase
    .from("work_orders")
    .select("id,status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) redirect("/work-orders");
  if (!(transitions[order.status] ?? []).includes(next)) {
    redirect(`/work-orders/${id}?error=invalid_transition`);
  }

  const { error } = await supabase
    .from("work_orders")
    .update({ status: next })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) redirect(`/work-orders/${id}?error=status_failed`);
  redirect(`/work-orders/${id}?saved=status`);
}

export async function updateWorkOrderDetails(formData: FormData) {
  const { supabase, organizationId } = await context();
  const id = await loadOrderId(formData);

  const { error } = await supabase
    .from("work_orders")
    .update({
      diagnosis: clean(formData.get("diagnosis")) || null,
      technician_notes: clean(formData.get("technician_notes")) || null,
      internal_notes: clean(formData.get("internal_notes")) || null,
      customer_approval: clean(formData.get("customer_approval")) || "pending",
      technician_id: clean(formData.get("technician_id")) || null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) redirect(`/work-orders/${id}?error=details_failed`);
  redirect(`/work-orders/${id}?saved=details`);
}

const dviTemplate = [
  ["exterior","body","Korin ja lasien yleiskunto"],
  ["exterior","lights","Valot ja suuntavilkut"],
  ["tires","tread","Renkaiden kunto ja kulutuspinta"],
  ["tires","pressure","Rengaspaineet"],
  ["brakes","brakes","Jarrujen silmämääräinen kunto"],
  ["fluids","levels","Nesteiden tasot ja vuodot"],
  ["engine","leaks","Moottoritilan vuodot ja poikkeamat"],
  ["underbody","suspension","Alustan ja jousituksen näkyvät poikkeamat"],
  ["safety","warning_lights","Varoitusvalot ja mittariston ilmoitukset"],
  ["interior","controls","Turvavarusteet ja hallintalaitteet"],
] as const;

export async function createDvi(formData: FormData) {
  const { supabase, userId, organizationId } = await context();
  const id = await loadOrderId(formData);

  const { data: existing } = await supabase
    .from("inspections")
    .select("id")
    .eq("work_order_id", id)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/work-orders/${id}?saved=dvi`);

  const { data: inspection, error } = await supabase
    .from("inspections")
    .insert({
      organization_id: organizationId,
      work_order_id: id,
      inspector_id: userId,
      result: "not_checked",
    })
    .select("id")
    .single();

  if (error || !inspection) redirect(`/work-orders/${id}?error=dvi_failed`);

  const { error: itemError } = await supabase.from("inspection_items").insert(
    dviTemplate.map(([category, itemKey, label]) => ({
      organization_id: organizationId,
      inspection_id: inspection.id,
      category,
      item_key: itemKey,
      label,
      result: "not_checked",
    })),
  );

  if (itemError) redirect(`/work-orders/${id}?error=dvi_failed`);
  redirect(`/work-orders/${id}?saved=dvi`);
}

export async function updateDviItem(formData: FormData) {
  const { supabase, organizationId } = await context();
  const orderId = await loadOrderId(formData);
  const itemId = clean(formData.get("item_id"));
  const result = clean(formData.get("result"));
  const notes = clean(formData.get("notes"));
  const measurement = clean(formData.get("measurement"));

  if (!itemId || !["not_checked","ok","attention","critical","not_applicable"].includes(result)) {
    redirect(`/work-orders/${orderId}?error=dvi_item_failed`);
  }

  const { error } = await supabase
    .from("inspection_items")
    .update({ result, notes: notes || null, measurement: measurement || null })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) redirect(`/work-orders/${orderId}?error=dvi_item_failed`);
  redirect(`/work-orders/${orderId}?saved=dvi`);
}
