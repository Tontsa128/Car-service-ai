"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null) { return String(value ?? "").trim(); }

export async function createWorkOrder(formData: FormData) {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getClaims();
  if(!auth?.claims?.sub) redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("organization_id").eq("id",auth.claims.sub).maybeSingle();
  if(!profile?.organization_id) redirect("/dashboard");

  const customerId=clean(formData.get("customer_id"));
  const vehicleId=clean(formData.get("vehicle_id"));
  if(!customerId||!vehicleId) redirect("/work-orders?error=required");

  const {data:order,error}=await supabase.from("work_orders").insert({
    organization_id:profile.organization_id, customer_id:customerId, vehicle_id:vehicleId,
    status:"draft", complaint:clean(formData.get("complaint"))||null,
    opened_at:new Date().toISOString()
  }).select("id").single();

  if(error||!order) redirect("/work-orders?error=create_failed");
  await supabase.from("work_order_status_history").insert({
    organization_id:profile.organization_id, work_order_id:order.id, from_status:null, to_status:"draft",
    changed_by:auth.claims.sub
  });
  redirect("/work-orders?created=1");
}
