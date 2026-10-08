"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null) { return String(value ?? "").trim(); }

export async function createAppointment(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("organization_id").eq("id", auth.claims.sub).maybeSingle();
  if (!profile?.organization_id) redirect("/dashboard");

  const customerId = clean(formData.get("customer_id"));
  const vehicleId = clean(formData.get("vehicle_id"));
  const startsAt = clean(formData.get("starts_at"));
  if (!customerId || !vehicleId || !startsAt) redirect("/appointments?error=required");

  const { error } = await supabase.from("appointments").insert({
    organization_id: profile.organization_id,
    customer_id: customerId,
    vehicle_id: vehicleId,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: clean(formData.get("ends_at")) ? new Date(clean(formData.get("ends_at"))).toISOString() : null,
    status: "requested",
    reason: clean(formData.get("reason")) || null,
    notes: clean(formData.get("notes")) || null,
  });

  if (error) redirect("/appointments?error=create_failed");
  redirect("/appointments?created=1");
}
