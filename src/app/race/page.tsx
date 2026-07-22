import { and, desc, eq } from "drizzle-orm";
import { getPlayerSession } from "@/lib/auth/player-session";
import { db } from "@/lib/db/client";
import { craftableUpgrades, playerDiceFaces, players, races, rollEvents } from "@/lib/db/schema";
import { getRouteOptions } from "@/lib/game/roll-resolution";
import { HabboVerifyForm } from "./habbo-verify-form";
import { RaceMap } from "./race-map";
import { CraftPanel } from "./craft-panel";
import { RouteChoicePanel } from "./route-choice-panel";
import { DiceBoxes } from "@/components/DiceBoxes";

export default async function RacePage() {
  const session = await getPlayerSession();

  if (!session) {
    return (
      <main style={{ maxWidth: 420, margin: "4rem auto" }}>
        <h1>Last Light</h1>
        <p>Verify your Habbo Origins account to join the race.</p>
        <HabboVerifyForm />
      </main>
    );
  }

  const [player] = await db.select().from(players).where(eq(players.id, session.playerId));
  if (!player) {
    return (
      <main style={{ maxWidth: 420, margin: "4rem auto" }}>
        <p>Session player not found. Try verifying again.</p>
      </main>
    );
  }

  const [race] = await db.select().from(races).where(eq(races.id, player.raceId));

  const diceFaces = await db.select().from(playerDiceFaces).where(eq(playerDiceFaces.playerId, player.id));
  const upgrades = await db
    .select()
    .from(craftableUpgrades)
    .where(eq(craftableUpgrades.raceId, player.raceId));

  const [pendingRoute] = await db
    .select()
    .from(rollEvents)
    .where(and(eq(rollEvents.playerId, player.id), eq(rollEvents.status, "pending_route")))
    .orderBy(desc(rollEvents.createdAt))
    .limit(1);

  const pendingRouteEffect = pendingRoute?.resolvedEffect as { reachedTileId: string } | undefined;
  const routeOptions = pendingRouteEffect ? await getRouteOptions(pendingRouteEffect.reachedTileId) : null;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 20px" }}>
      <h1>Last Light</h1>
      <p>Welcome back, {player.habboUsername}.</p>
      <p>Race status: {race?.status}</p>
      <p>
        Your turn slot: {player.turnOrderIndex}
        {race?.currentTurnIndex === player.turnOrderIndex && " — it's your turn!"}
      </p>
      <p>
        Resources: {player.commonResource} common · {player.rareResource} rare
      </p>

      {routeOptions && (
        <>
          <h2 style={{ marginTop: 32 }}>Choose your path</h2>
          <RouteChoicePanel initialOptions={routeOptions} />
        </>
      )}

      <h2 style={{ marginTop: 32 }}>Your dice</h2>
      <DiceBoxes faces={diceFaces} />

      <h2 style={{ marginTop: 32 }}>Shop</h2>
      <CraftPanel
        upgrades={upgrades}
        playerFaces={diceFaces}
        commonResource={player.commonResource}
        rareResource={player.rareResource}
      />

      <h2 style={{ marginTop: 32 }}>Board</h2>
      <RaceMap />
    </main>
  );
}
