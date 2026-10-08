import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createWorkOrder } from "./actions";

function name(c:{type:"person"|"company";first_name:string|null;last_name:string|null;company_name:string|null}) {
  return c.type==="company"?c.company_name||"Nimetön yritys":[c.first_name,c.last_name].filter(Boolean).join(" ")||"Nimetön asiakas";
}

export default async function WorkOrdersPage({searchParams}:{searchParams:Promise<{error?:string;created?:string}>}) {
  const params=await searchParams; const supabase=await createClient();
  const {data:auth}=await supabase.auth.getClaims(); if(!auth?.claims?.sub) redirect("/login");
  const [{data:customers},{data:vehicles},{data:orders}]=await Promise.all([
    supabase.from("customers").select("id,type,first_name,last_name,company_name"),
    supabase.from("vehicles").select("id,customer_id,registration_number,make,model"),
    supabase.from("work_orders").select("id,number,customer_id,vehicle_id,status,complaint,opened_at").order("created_at",{ascending:false}).limit(50)
  ]);
  const customerMap=new Map((customers??[]).map(c=>[c.id,name(c)]));
  const vehicleMap=new Map((vehicles??[]).map(v=>[v.id,[v.registration_number,v.make,v.model].filter(Boolean).join(" · ")||"Ajoneuvo"]));
  const errorText=params.error==="required"?"Asiakas ja ajoneuvo ovat pakollisia.":params.error==="create_failed"?"Työmääräyksen luonti epäonnistui.":null;

  return <main className="module-shell">
    <header className="module-header"><div><Link className="back-link" href="/dashboard">← Työpöytä</Link><div className="eyebrow">WORK ORDERS</div><h1>Työmääräykset</h1><p>Jokainen työ alkaa tunnistettavasta autosta, asiakkaasta ja dokumentoidusta työpyynnöstä.</p></div></header>
    {params.created&&<div className="success-box">Työmääräys luotiin luonnoksena.</div>}{errorText&&<div className="error-box">{errorText}</div>}
    <section className="module-layout">
      <form className="form-card" action={createWorkOrder}><div className="card-heading"><div><div className="eyebrow">UUSI TYÖ</div><h2>Työmääräys</h2></div></div>
        <label>Asiakas<select name="customer_id" required defaultValue=""><option value="" disabled>Valitse asiakas</option>{(customers??[]).map(c=><option key={c.id} value={c.id}>{name(c)}</option>)}</select></label>
        <label>Ajoneuvo<select name="vehicle_id" required defaultValue=""><option value="" disabled>Valitse ajoneuvo</option>{(vehicles??[]).map(v=><option key={v.id} value={v.id}>{vehicleMap.get(v.id)} · {customerMap.get(v.customer_id)||"Asiakas"}</option>)}</select></label>
        <label>Asiakkaan ilmoittama vika / työpyyntö<textarea name="complaint" rows={5} placeholder="Kirjaa asiakkaan oma kuvaus mahdollisimman tarkasti." /></label>
        <button className="primary-button" type="submit">Luo työmääräys</button>
      </form>
      <section className="list-card"><div className="card-heading"><div><div className="eyebrow">AKTIIVISET TYÖT</div><h2>Työmääräykset</h2></div><span className="count-badge">{orders?.length??0}</span></div>
        {!orders?.length?<div className="empty-state"><strong>Ei työmääräyksiä vielä.</strong><span>Kun työ luodaan, seuraava vaihe on diagnoosi ja DVI.</span></div>:
        <div className="record-list">{orders.map(o=><article className="record-row" key={o.id}><div><strong>#{o.number} · {vehicleMap.get(o.vehicle_id)||"Ajoneuvo"}</strong><span>{customerMap.get(o.customer_id)||"Asiakas"} · {o.complaint||"Työpyyntöä ei kirjattu"}</span></div><span className="status-chip">{o.status}</span></article>)}</div>}
      </section>
    </section>
  </main>;
}
