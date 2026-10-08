import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createCustomer } from "./actions";

function customerName(customer: {
  type: "person" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}) {
  if (customer.type === "company") return customer.company_name || "Nimetön yritys";
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Nimetön asiakas";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,type,first_name,last_name,company_name,email,phone,city,created_at")
    .order("created_at", { ascending: false });

  const errorText =
    params.error === "last_name_required" ? "Anna henkilölle vähintään sukunimi." :
    params.error === "company_name_required" ? "Anna yritykselle nimi." :
    params.error === "create_failed" ? "Asiakkaan tallennus epäonnistui. Tarkista tietokanta ja oikeudet." :
    error ? "Asiakkaita ei voitu hakea." : null;

  return (
    <main className="module-shell">
      <header className="module-header">
        <div>
          <Link className="back-link" href="/dashboard">← Työpöytä</Link>
          <div className="eyebrow">CUSTOMERS</div>
          <h1>Asiakkaat</h1>
          <p>Yksi asiakas voi omistaa useita ajoneuvoja. Tiedot pidetään valmiina ajanvaraukseen, työmääräykseen ja huoltohistoriaan.</p>
        </div>
      </header>

      {params.created && <div className="success-box">Asiakas lisättiin rekisteriin.</div>}
      {errorText && <div className="error-box">{errorText}</div>}

      <section className="module-layout">
        <form className="form-card" action={createCustomer}>
          <div className="card-heading">
            <div><div className="eyebrow">UUSI ASIAKAS</div><h2>Lisää asiakas</h2></div>
          </div>
          <label>Asiakastyyppi
            <select name="type" defaultValue="person">
              <option value="person">Henkilö</option>
              <option value="company">Yritys</option>
            </select>
          </label>
          <div className="form-two">
            <label>Etunimi<input name="first_name" autoComplete="given-name" /></label>
            <label>Sukunimi<input name="last_name" autoComplete="family-name" /></label>
          </div>
          <label>Yrityksen nimi<input name="company_name" autoComplete="organization" /></label>
          <div className="form-two">
            <label>Sähköposti<input name="email" type="email" autoComplete="email" /></label>
            <label>Puhelin<input name="phone" type="tel" autoComplete="tel" /></label>
          </div>
          <div className="form-two">
            <label>Postinumero<input name="postal_code" autoComplete="postal-code" /></label>
            <label>Kaupunki<input name="city" autoComplete="address-level2" /></label>
          </div>
          <label>Osoite<input name="address" autoComplete="street-address" /></label>
          <label>Muistiinpanot<textarea name="notes" rows={3} /></label>
          <button className="primary-button" type="submit">Tallenna asiakas</button>
        </form>

        <section className="list-card">
          <div className="card-heading">
            <div><div className="eyebrow">REKISTERI</div><h2>Asiakkaat</h2></div>
            <span className="count-badge">{customers?.length ?? 0}</span>
          </div>
          {!customers?.length ? (
            <div className="empty-state"><strong>Ei asiakkaita vielä.</strong><span>Lisää ensimmäinen asiakas vasemmalta.</span></div>
          ) : (
            <div className="record-list">
              {customers.map((customer) => (
                <article className="record-row" key={customer.id}>
                  <div>
                    <strong>{customerName(customer)}</strong>
                    <span>{customer.email || customer.phone || customer.city || "Yhteystietoja ei vielä ole"}</span>
                  </div>
                  <Link href={`/vehicles?customer=${customer.id}`} className="row-action">Autot →</Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
