import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAppointment } from "./actions";

function name(c: { type: "person"|"company"; first_name:string|null; last_name:string|null; company_name:string|null }) {
  return c.type === "company" ? c.company_name || "Nimetön yritys" : [c.first_name,c.last_name].filter(Boolean).join(" ") || "Nimetön asiakas";
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{error?:string;created?:string}> }) {
  const params=await searchParams;
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getClaims();
  if(!auth?.claims?.sub) redirect("/login");

  const [{data:customers},{data:vehicles},{data:appointments}]=await Promise.all([
    supabase.from("customers").select("id,type,first_name,last_name,company_name").order("last_name"),
    supabase.from("vehicles").select("id,customer_id,registration_number,make,model").order("make"),
    supabase.from("appointments").select("id,customer_id,vehicle_id,starts_at,status,reason").order("starts_at",{ascending:true}).limit(50)
  ]);
  const customerMap=new Map((customers??[]).map(c=>[c.id,name(c)]));
  const vehicleMap=new Map((vehicles??[]).map(v=>[v.id,[v.registration_number,v.make,v.model].filter(Boolean).join(" · ")||"Ajoneuvo"]));
  const errorText=params.error==="required"?"Asiakas, ajoneuvo ja aloitusaika ovat pakollisia.":params.error==="create_failed"?"Ajanvarauksen tallennus epäonnistui.":null;

  return <main className="module-shell">
    <header className="module-header"><div>
      <Link className="back-link" href="/dashboard">← Työpöytä</Link>
      <div className="eyebrow">APPOINTMENTS</div><h1>Ajanvaraukset</h1>
      <p>Vastaanotto alkaa siitä, että asiakkaan auto ja työn tarkoitus saadaan kalenteriin.</p>
    </div></header>
    {params.created&&<div className="success-box">Ajanvaraus lisättiin.</div>}{errorText&&<div className="error-box">{errorText}</div>}
    <section className="module-layout">
      <form className="form-card" action={createAppointment}>
        <div className="card-heading"><div><div className="eyebrow">UUSI KÄYNTI</div><h2>Varaa aika</h2></div></div>
        <label>Asiakas<select name="customer_id" required defaultValue=""><option value="" disabled>Valitse asiakas</option>{(customers??[]).map(c=><option key={c.id} value={c.id}>{name(c)}</option>)}</select></label>
        <label>Ajoneuvo<select name="vehicle_id" required defaultValue=""><option value="" disabled>Valitse ajoneuvo</option>{(vehicles??[]).map(v=><option key={v.id} value={v.id}>{vehicleMap.get(v.id)} · {customerMap.get(v.customer_id) || "Asiakas"}</option>)}</select></label>
        <div className="form-two"><label>Alkaa<input name="starts_at" type="datetime-local" required /></label><label>Päättyy<input name="ends_at" type="datetime-local" /></label></div>
        <label>Työn syy / asiakkaan kuvaus<textarea name="reason" rows={3} placeholder="Esim. jarrut täristävät jarrutuksessa" /></label>
        <label>Muistiinpanot<textarea name="notes" rows={2} /></label>
        <button className="primary-button" type="submit">Tallenna ajanvaraus</button>
      </form>
      <section className="list-card"><div className="card-heading"><div><div className="eyebrow">TYÖJONO</div><h2>Tulevat käynnit</h2></div><span className="count-badge">{appointments?.length??0}</span></div>
        {!appointments?.length?<div className="empty-state"><strong>Ei ajanvarauksia vielä.</strong><span>Ensimmäinen vastaanottokäynti voidaan lisätä vasemmalta.</span></div>:
        <div className="record-list">{appointments.map(a=><article className="record-row" key={a.id}><div><strong>{vehicleMap.get(a.vehicle_id)||"Ajoneuvo"}</strong><span>{customerMap.get(a.customer_id)||"Asiakas"} · {new Date(a.starts_at).toLocaleString("fi-FI")} · {a.reason||"Työn syy puuttuu"}</span></div><span className="status-chip">{a.status}</span></article>)}</div>}
      </section>
    </section>
  </main>;
}
