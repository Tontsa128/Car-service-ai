import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createDvi,
  updateDviItem,
  updateWorkOrderDetails,
  updateWorkOrderStatus,
} from "./actions";

const statusLabels: Record<string, string> = {
  draft: "Luonnos",
  awaiting_approval: "Odottaa hyväksyntää",
  approved: "Hyväksytty",
  in_progress: "Työn alla",
  quality_check: "Laaduntarkastus",
  ready: "Valmis",
  invoiced: "Laskutettu",
  closed: "Suljettu",
  cancelled: "Peruttu",
};

const resultLabels: Record<string,string> = {
  not_checked:"Tarkistamatta",
  ok:"OK",
  attention:"Huomio",
  critical:"Kriittinen",
  not_applicable:"Ei sovellu",
};

const transitions: Record<string,string[]> = {
  draft:["awaiting_approval","cancelled"],
  awaiting_approval:["approved","cancelled"],
  approved:["in_progress","cancelled"],
  in_progress:["quality_check","cancelled"],
  quality_check:["ready","in_progress"],
  ready:["invoiced","in_progress"],
  invoiced:["closed"],
  closed:[],
  cancelled:[],
};

function customerName(c:any) {
  return c.type === "company"
    ? c.company_name || "Nimetön yritys"
    : [c.first_name,c.last_name].filter(Boolean).join(" ") || "Nimetön asiakas";
}

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{id:string}>;
  searchParams: Promise<{error?:string;saved?:string}>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: order } = await supabase
    .from("work_orders")
    .select("id,number,status,complaint,diagnosis,technician_notes,internal_notes,customer_approval,estimated_total,final_total,opened_at,created_at,customer_id,vehicle_id,technician_id")
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const [{data:customer},{data:vehicle},{data:technicians},{data:history},{data:inspection}] = await Promise.all([
    supabase.from("customers").select("id,type,first_name,last_name,company_name,email,phone").eq("id",order.customer_id).maybeSingle(),
    supabase.from("vehicles").select("id,registration_number,vin,make,model,model_year,odometer_km,engine,fuel_type").eq("id",order.vehicle_id).maybeSingle(),
    supabase.from("profiles").select("id,full_name,role").in("role",["owner","admin","manager","technician"]).eq("active",true).order("full_name"),
    supabase.from("work_order_status_history").select("id,from_status,to_status,reason,created_at,changed_by").eq("work_order_id",id).order("created_at",{ascending:false}),
    supabase.from("inspections").select("id,result,notes,completed_at,inspector_id,inspection_items(id,category,item_key,label,result,notes,measurement)").eq("work_order_id",id).maybeSingle(),
  ]);

  const technicianMap = new Map((technicians??[]).map(t=>[t.id,t.full_name||"Asentaja"]));
  const vehicleLabel = [vehicle?.registration_number,vehicle?.make,vehicle?.model,vehicle?.model_year].filter(Boolean).join(" · ");
  const nextStatuses = transitions[order.status] ?? [];
  const errorText = query.error === "invalid_transition" ? "Tilasiirtymä ei ole sallittu." :
    query.error ? "Tallennus epäonnistui. Tarkista tiedot ja yritä uudelleen." : null;
  const savedText = query.saved === "status" ? "Työmääräyksen tila päivitettiin." :
    query.saved === "details" ? "Työmääräyksen tiedot tallennettiin." :
    query.saved === "dvi" ? "DVI-tarkastus tallennettiin." : null;

  return <main className="module-shell">
    <header className="module-header">
      <div>
        <Link className="back-link" href="/work-orders">← Työmääräykset</Link>
        <div className="eyebrow">TYÖMÄÄRÄYS #{order.number}</div>
        <h1>{vehicleLabel || "Ajoneuvo"} </h1>
        <p>{customer ? customerName(customer) : "Asiakas"} · {order.complaint || "Työpyyntöä ei kirjattu"}</p>
      </div>
      <div className="detail-status"><span className="status-chip">{statusLabels[order.status] || order.status}</span></div>
    </header>

    {savedText && <div className="success-box">{savedText}</div>}
    {errorText && <div className="error-box">{errorText}</div>}

    <section className="detail-grid">
      <section className="form-card">
        <div className="card-heading"><div><div className="eyebrow">TYÖN OHJAUS</div><h2>Seuraava tila</h2></div></div>
        {nextStatuses.length ? <form action={updateWorkOrderStatus} className="inline-form">
          <input type="hidden" name="work_order_id" value={order.id}/>
          <select name="status" defaultValue={nextStatuses[0]}>
            {nextStatuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <button className="primary-button" type="submit">Päivitä tila</button>
        </form> : <p className="muted-copy">Työmääräys on päättävässä tilassa.</p>}
        <div className="detail-meta">
          <div><span>Asiakas</span><strong>{customer ? customerName(customer) : "—"}</strong></div>
          <div><span>Puhelin</span><strong>{customer?.phone || "—"}</strong></div>
          <div><span>Ajoneuvo</span><strong>{vehicleLabel || "—"}</strong></div>
          <div><span>VIN</span><strong>{vehicle?.vin || "—"}</strong></div>
          <div><span>Mittarilukema</span><strong>{vehicle?.odometer_km != null ? `${vehicle.odometer_km.toLocaleString("fi-FI")} km` : "—"}</strong></div>
          <div><span>Polttoaine</span><strong>{vehicle?.fuel_type || "—"}</strong></div>
        </div>
      </section>

      <form className="form-card" action={updateWorkOrderDetails}>
        <div className="card-heading"><div><div className="eyebrow">TYÖN TIEDOT</div><h2>Diagnoosi & vastuuhenkilö</h2></div></div>
        <input type="hidden" name="work_order_id" value={order.id}/>
        <label>Asentaja<select name="technician_id" defaultValue={order.technician_id ?? ""}><option value="">Ei määritetty</option>{(technicians??[]).map(t=><option key={t.id} value={t.id}>{t.full_name || "Nimetön"} · {t.role}</option>)}</select></label>
        <label>Diagnoosi<textarea name="diagnosis" rows={5} defaultValue={order.diagnosis ?? ""} placeholder="Kirjaa löydökset, mittaukset ja diagnoosin perusteet." /></label>
        <label>Asentajan työmuistiinpanot<textarea name="technician_notes" rows={4} defaultValue={order.technician_notes ?? ""} /></label>
        <label>Sisäinen huomio<textarea name="internal_notes" rows={3} defaultValue={order.internal_notes ?? ""} /></label>
        <label>Asiakkaan hyväksyntä<select name="customer_approval" defaultValue={order.customer_approval}><option value="pending">Odottaa</option><option value="approved">Hyväksytty</option><option value="rejected">Hylätty</option><option value="expired">Vanhentunut</option></select></label>
        <button className="primary-button" type="submit">Tallenna työn tiedot</button>
      </form>
    </section>

    <section className="detail-grid">
      <section className="list-card">
        <div className="card-heading"><div><div className="eyebrow">DVI</div><h2>Digitaalinen ajoneuvotarkastus</h2></div></div>
        {!inspection ? <form action={createDvi}><input type="hidden" name="work_order_id" value={order.id}/><p className="muted-copy">Luo tarkastuslista ennen diagnoosin hyväksymistä. Jokainen havainto kirjataan erikseen.</p><button className="primary-button" type="submit">Aloita DVI-tarkastus</button></form> :
          <div className="dvi-list">{(inspection.inspection_items??[]).map((item:any)=><form className="dvi-item" action={updateDviItem} key={item.id}>
            <input type="hidden" name="work_order_id" value={order.id}/><input type="hidden" name="item_id" value={item.id}/>
            <div><strong>{item.label}</strong><span>{item.category}</span></div>
            <select name="result" defaultValue={item.result}>{Object.entries(resultLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
            <input name="measurement" defaultValue={item.measurement??""} placeholder="Mittaustieto" />
            <input name="notes" defaultValue={item.notes??""} placeholder="Havainto / huomio" />
            <button className="row-action-button" type="submit">Tallenna</button>
          </form>)}</div>}
      </section>

      <section className="list-card">
        <div className="card-heading"><div><div className="eyebrow">HISTORIA</div><h2>Tilamuutokset</h2></div></div>
        {!history?.length ? <p className="muted-copy">Ei tilamuutoksia vielä.</p> :
          <div className="timeline">{history.map(h=><div className="timeline-item" key={h.id}><strong>{h.from_status ? statusLabels[h.from_status] : "Luotu"} → {statusLabels[h.to_status] || h.to_status}</strong><span>{new Date(h.created_at).toLocaleString("fi-FI")} · {h.changed_by ? technicianMap.get(h.changed_by) || "Käyttäjä" : "Järjestelmä"}</span></div>)}</div>}
      </section>
    </section>
  </main>;
}
