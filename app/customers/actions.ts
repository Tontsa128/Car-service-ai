"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("organization_id").eq("id", auth.claims.sub).maybeSingle();
  if (!profile?.organization_id) redirect("/dashboard");

  const type = clean(formData.get("type")) === "company" ? "company" : "person";
  const firstName = clean(formData.get("first_name"));
  const lastName = clean(formData.get("last_name"));
  const companyName = clean(formData.get("company_name"));

  if (type === "person" && !lastName) redirect("/customers?error=last_name_required");
  if (type === "company" && !companyName) redirect("/customers?error=company_name_required");

  const { error } = await supabase.from("customers").insert({
    organization_id: profile.organization_id,
    type,
    first_name: firstName || null,
    last_name: lastName || null,
    company_name: companyName || null,
    email: clean(formData.get("email")) || null,
    phone: clean(formData.get("phone")) || null,
    address: clean(formData.get("address")) || null,
    postal_code: clean(formData.get("postal_code")) || null,
    city: clean(formData.get("city")) || null,
    notes: clean(formData.get("notes")) || null,
  });

  if (error) redirect("/customers?error=create_failed");
  redirect("/customers?created=1");
}
