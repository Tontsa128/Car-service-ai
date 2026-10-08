import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">CAR SERVICE AI</div>
        <h1>Kirjaudu korjaamon työtilaan</h1>
        <p>Hallitse asiakkaita, ajoneuvoja ja työmääräyksiä turvallisesti yhdessä paikassa.</p>

        {hasError && (
          <div className="error-box" role="alert">
            Tarkista sähköpostiosoite ja salasana.
          </div>
        )}

        <form action={signIn} className="auth-form">
          <label>
            Sähköposti
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Salasana
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Kirjaudu</button>
        </form>
      </section>
    </main>
  );
}
