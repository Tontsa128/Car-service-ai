import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createVehicle } from "./actions";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; customer?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const [{ data: customers, error: customersError }, { data: vehicles, error: vehiclesError }] =
    await Promise.all([
      supabase.from("customers").select("id,type,first_name,last_name,company_name").order("last_name", { ascending: true }),
      supabase.from("vehicles").select("id,customer_id,registration_number,vin,make,model,model_year,odometer_km,engine,fuel_type").order("created_at", { ascending: false }),
    ]);

  const customerMap = new Map(
    (customers ?? []).map((customer) => [
      customer.id,
      customer.type === "company"
        ? customer.company_name || "Nimetön yritys"
        : [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Nimetön asiakas",
    ]),
  );

  const errorText =
    params.error === "required" ? "Asiakas, merkki ja malli ovat pakollisia." :
    params.error === "create_failed" ? "Ajoneuvon tallennus epäonnistui. Tarkista VIN, rekisterinumero ja oikeudet." :
    customersError || vehiclesError ? "Ajoneuvotietoja ei voitu hakea." : null;

  return (
    <main className="module-shell">
      <header className="module-header">
        <div>
          <Link className="back-link" href="/dashboard">← Työpöytä</Link>
          <div className="eyebrow">VEHICLES</div>
          <h1>Ajoneuvot</h1>
          <p>VIN, rekisteri, mittarilukema ja käyttövoima kulkevat ajoneuvon mukana koko huoltohistorian ajan.</p>
        </div>
      </header>

      {params.created && <div className="success-box">Ajoneuvo lisättiin rekisteriin.</div>}
      {errorText && <div className="error-box">{errorText}</div>}

      <section className="module-layout">
        <form className="form-card" action={createVehicle}>
          <div className="card-heading">
            <div><div className="eyebrow">UUSI AJONEUVO</div><h2>Lisää auto</h2></div>
          </div>
          <label>Omistaja / asiakas
            <select name="customer_id" defaultValue={params.customer ?? ""} required>
              <option value="" disabled>Valitse asiakas</option>
              {(customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.type === "company" ? customer.company_name || "Nimetön yritys" : [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Nimetön asiakas"}
                </option>
              ))}
            </select>
          </label>
          <div className="form-two">
            <label>Rekisteritunnus<input name="registration_number" autoCapitalize="characters" /></label>
            <label>VIN<input name="vin" maxLength={17} autoCapitalize="characters" /></label>
          </div>
          <div className="form-two">
            <label>Merkki<input name="make" required placeholder="Toyota" /></label>
            <label>Malli<input name="model" required placeholder="Corolla" /></label>
          </div>
          <div className="form-two">
            <label>Vuosimalli<input name="model_year" type="number" min="1900" max="2100" /></label>
            <label>Mittarilukema km<input name="odometer_km" type="number" min="0" /></label>
          </div>
          <div className="form-two">
            <label>Moottori<input name="engine" placeholder="1.8 Hybrid" /></label>
            <label>Käyttövoima<input name="fuel_type" placeholder="Bensiini / hybridi / sähkö" /></label>
          </div>
          <label>Muistiinpanot<textarea name="notes" rows={3} /></label>
          <button className="primary-button" type="submit">Tallenna ajoneuvo</button>
        </form>

        <section className="list-card">
          <div className="card-heading">
            <div><div className="eyebrow">AUTOKANTA</div><h2>Ajoneuvot</h2></div>
            <span className="count-badge">{vehicles?.length ?? 0}</span>
          </div>
          {!vehicles?.length ? (
            <div className="empty-state"><strong>Ei ajoneuvoja vielä.</strong><span>Lisää asiakas ensin ja liitä ajoneuvo siihen.</span></div>
          ) : (
            <div className="record-list">
              {vehicles.map((vehicle) => (
                <article className="record-row" key={vehicle.id}>
                  <div>
                    <strong>{[vehicle.registration_number, vehicle.make, vehicle.model].filter(Boolean).join(" · ") || "Nimetön ajoneuvo"}</strong>
                    <span>{customerMap.get(vehicle.customer_id) || "Asiakas"} · {vehicle.model_year || "Vuosimalli —"} · {vehicle.odometer_km != null ? `${vehicle.odometer_km.toLocaleString("fi-FI")} km` : "Mittarilukema —"}</span>
                  </div>
                  <span className="status-chip">{vehicle.fuel_type || "Käyttövoima —"}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
