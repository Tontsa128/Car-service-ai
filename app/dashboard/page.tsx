import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const cards = [
  ["Tämän päivän työt", "Ajanvaraukset ja aktiiviset työmääräykset"],
  ["Hyväksynnät", "Asiakkaan hyväksyntää odottavat työt"],
  ["Laadunvarmistus", "Valmiit työt ennen luovutusta"],
  ["Laskutus", "Laskutusta odottavat työmääräykset"],
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/login");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow">WORKSHOP OS</div>
          <h1>Työpöytä</h1>
          <p>Korjaamon päivän tärkeimmät asiat yhdellä näkymällä.</p>
        </div>
      </header>

      <section className="dashboard-grid">
        {cards.map(([title, description]) => (
          <article className="dashboard-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span>Valmistellaan moduulia</span>
          </article>
        ))}
      </section>
    </main>
  );
}
