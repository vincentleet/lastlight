export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>Last Light</h1>
      <p style={{ color: "var(--ink-soft)" }}>A rogue-lite PvP dice race hosted on Habbo Origins.</p>
      <p>
        <a href="/race">Join the race</a> · <a href="/admin">Admin</a>
      </p>
    </main>
  );
}
