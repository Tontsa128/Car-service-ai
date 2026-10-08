import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const cards = [
  ["Asiakkaat", "Asiakasrekisteri, yhteystiedot ja ajoneuvot.", "/customers"],
  ["Ajoneuvot", "Autokanta, mittarilukemat ja huoltohistoria.", "/vehicles"],
  ["Ajanvaraukset", "Päivän työjono ja tulevat käynnit.", "/appointments"],
  ["Työmääräykset", "Työt, diagnoosit, hyväksynnät ja työn eteneminen.", "/work-orders"],
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow">CAR SERVICE AI · WORKSHOP OS</div>
          <h1>Korjaamon työpöytä</h1>
          <p>Asiakkaat, ajoneuvot ja työnkulku rakennetaan yhden selkeän käyttöliittymän ympärille.</p>
        </div>
        <nav className="dashboard-nav" aria-label="Päävalikko">
          <Link href="/dashboard" className="nav-link active">Työpöytä</Link>
          <Link href="/customers" className="nav-link">Asiakkaat</Link>
          <Link href="/vehicles" className="nav-link">Ajoneuvot</Link>
        </nav>
      </header>
      <section className="dashboard-grid" aria-label="Moduulit">
        {cards.map(([title, description, href]) => (
          <Link className="dashboard-card dashboard-card-link" href={href} key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span>Avaa moduuli →</span>
          </Link>
        ))}
      </section>
      <section className="dashboard-intro">
        <div>
          <div className="eyebrow">RAKENNETAAN OIKEASSA JÄRJESTYKSESSÄ</div>
          <h2>Seuraava perusta: asiakas → auto → työmääräys.</h2>
        </div>
        <p>Vanhoista projekteista otetaan parhaat ideat, mutta tuotantokoodi pidetään selkeänä, testattavana ja Supabase RLS -turvallisuuden ympärillä.</p>
      </section>
    </main>
  );
}
