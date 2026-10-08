const modules = [
  ["Asiakkaat", "Asiakaskortit, yhteystiedot ja viestintähistoria."],
  ["Ajoneuvot", "Ajoneuvon perustiedot, huoltohistoria ja dokumentit."],
  ["Ajanvaraus", "Kalenteri, resurssit ja työmääräysten muodostaminen."],
  ["Työmääräykset", "Diagnoosi, työvaiheet, kuvat, hyväksynnät ja laadunvarmistus."],
  ["Osat ja varasto", "Osat, toimittajat, saatavuus ja kustannukset."],
  ["Laskutus", "Tarjoukset, hyväksynnät, laskut ja maksutilanne."],
  ["Raportointi", "Korjaamon käyttöaste, myynti, kate ja työn tuottavuus."],
  ["AI-avustaja", "Turvallinen AI, joka käyttää vain varmennettua tietoa."],
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">CAR SERVICE AI · WORKSHOP OS</div>
        <h1>Korjaamon koko työketju yhdessä järjestelmässä.</h1>
        <p>
          Rakennamme moniyrityksisen SaaS-alustan, joka yhdistää asiakkaat,
          ajoneuvot, ajanvaraukset, työmääräykset, diagnostiikan, osat,
          laskutuksen ja huoltohistorian.
        </p>
        <div className="flow" aria-label="Korjaamon pääprosessi">
          <span>Asiakas</span><b>→</b><span>Ajoneuvo</span><b>→</b>
          <span>Ajanvaraus</span><b>→</b><span>Työmääräys</span><b>→</b>
          <span>Korjaus</span><b>→</b><span>Lasku</span><b>→</b><span>Historia</span>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div className="eyebrow">FOUNDATION</div>
          <h2>Ensimmäinen versio rakennetaan oikein alusta asti.</h2>
          <p>
            Monivuokraus, RLS-tietoturva, roolit, audit trail ja kaksikielinen
            käyttöliittymä ovat arkkitehtuurin perusta, eivät myöhempi lisäosa.
          </p>
        </div>
        <div className="grid">
          {modules.map(([title, description]) => (
            <article className="card" key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>Car Service AI</span>
        <span>Foundation v0.1</span>
      </footer>
    </main>
  );
}
