"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function nullableInt(value: FormDataEntryValue | null) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createVehicle(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("organization_id").eq("id", auth.claims.sub).maybeSingle();
  if (!profile?.organization_id) redirect("/dashboard");

  const customerId = clean(formData.get("customer_id"));
  const registration = clean(formData.get("registration_number")).toUpperCase();
  const make = clean(formData.get("make"));
  const model = clean(formData.get("model"));

  if (!customerId || !make || !model) redirect("/vehicles?error=required");

  const { error } = await supabase.from("vehicles").insert({
    organization_id: profile.organization_id,
    customer_id: customerId,
    registration_number: registration || null,
    vin: clean(formData.get("vin")).toUpperCase() || null,
    make,
    model,
    model_year: nullableInt(formData.get("model_year")),
    odometer_km: nullableInt(formData.get("odometer_km")),
    engine: clean(formData.get("engine")) || null,
    fuel_type: clean(formData.get("fuel_type")) || null,
    notes: clean(formData.get("notes")) || null,
  });

  if (error) redirect("/vehicles?error=create_failed");
  redirect("/vehicles?created=1");
}
