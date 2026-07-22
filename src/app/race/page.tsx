import { eq } from "drizzle-orm";
import { getPlayerSession } from "@/lib/auth/player-session";
import { db } from "@/lib/db/client";
import { craftableUpgrades, playerDiceFaces, players, races, tiles } from "@/lib/db/schema";
import { HabboVerifyForm } from "./habbo-verify-form";
import { RaceMap } from "./race-map";
import { CraftPanel } from "./craft-panel";
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

  const currentTile = player.currentTileId
    ? (await db.select().from(tiles).where(eq(tiles.id, player.currentTileId)))[0]
    : null;
  const atShop = currentTile?.tileType === "merchant";

  const upgrades = atShop
    ? await db.select().from(craftableUpgrades).where(eq(craftableUpgrades.raceId, player.raceId))
    : [];

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

      <h2 style={{ marginTop: 32 }}>Your dice</h2>
      <DiceBoxes faces={diceFaces} />

      <h2 style={{ marginTop: 32 }}>Shop</h2>
      {atShop ? (
        <CraftPanel
          upgrades={upgrades}
          playerFaces={diceFaces}
          commonResource={player.commonResource}
          rareResource={player.rareResource}
        />
      ) : (
        <p style={{ color: "var(--ink-soft)" }}>
          The shop is only open at a Merchant tile — you&apos;re currently at{" "}
          {currentTile?.label ?? "an unknown location"}.
        </p>
      )}

      <h2 style={{ marginTop: 32 }}>Board</h2>
      <RaceMap />
    </main>
  );
}
