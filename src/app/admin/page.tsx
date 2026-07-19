import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { players, races } from "@/lib/db/schema";
import { signOut } from "./login/actions";

export default async function AdminPage() {
  await requireAdmin();

  const [race] = await db.select().from(races).orderBy(desc(races.createdAt)).limit(1);

  const roster = race
    ? await db
        .select()
        .from(players)
        .where(eq(players.raceId, race.id))
        .orderBy(players.turnOrderIndex)
    : [];

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Last Light — Admin</h1>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>

      {!race ? (
        <p>No race created yet.</p>
      ) : (
        <>
          <p>
            Race status: <strong>{race.status}</strong> · Current turn index:{" "}
            {race.currentTurnIndex ?? "—"}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">#</th>
                <th align="left">Habbo</th>
                <th align="left">Status</th>
                <th align="left">Common</th>
                <th align="left">Rare</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((player) => (
                <tr key={player.id}>
                  <td>{player.turnOrderIndex}</td>
                  <td>{player.habboUsername ?? "—"}</td>
                  <td>{player.status}</td>
                  <td>{player.commonResource}</td>
                  <td>{player.rareResource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
