import { signInWithDiscord } from "./actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", textAlign: "center" }}>
      <h1>Last Light — Admin</h1>
      {error === "not_allowed" && (
        <p style={{ color: "crimson" }}>That Discord account isn&apos;t on the admin allowlist.</p>
      )}
      {error === "oauth_failed" && <p style={{ color: "crimson" }}>Sign-in failed. Try again.</p>}
      <form action={signInWithDiscord}>
        <button type="submit">Sign in with Discord</button>
      </form>
    </main>
  );
}
