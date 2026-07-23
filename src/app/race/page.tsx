import { and, eq } from "drizzle-orm";
import { getPlayerSession } from "@/lib/auth/player-session";
import { db } from "@/lib/db/client";
import { craftableUpgrades, playerDiceFaces, players, races, rollEvents, tiles } from "@/lib/db/schema";
import { getAvatarImageUrl } from "@/lib/habbo/motto";
import { TILE_STYLE } from "@/lib/game/tile-style";
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
  const tileStyle = TILE_STYLE[currentTile?.tileType ?? "unknown"] ?? TILE_STYLE.unknown;

  const upgrades = atShop
    ? await db.select().from(craftableUpgrades).where(eq(craftableUpgrades.raceId, player.raceId))
    : [];

  const [pendingRoute] = await db
    .select({ id: rollEvents.id })
    .from(rollEvents)
    .where(and(eq(rollEvents.playerId, player.id), eq(rollEvents.status, "pending_route")))
    .limit(1);

  const isMyTurn = race?.currentTurnIndex === player.turnOrderIndex;

  const activeBoxStyle: React.CSSProperties = {
    background: tileStyle.color,
    color: "#0b0f14",
    borderRadius: 16,
    padding: "32px 28px",
    textAlign: "center",
    marginTop: 24,
  };

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 20px" }}>
      <h1>Last Light</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {player.figureString && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getAvatarImageUrl(player.figureString)}
            alt={`${player.habboUsername}'s avatar`}
            width={64}
            height={110}
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <p>Welcome back, {player.habboUsername}.</p>
      </div>
      <p>
        Race status: {race?.status} · Resources: {player.commonResource} common · {player.rareResource} rare
      </p>

      <h2 style={{ marginTop: 32 }}>Your dice</h2>
      <DiceBoxes faces={diceFaces} />

      {atShop ? (
        <section style={activeBoxStyle}>
          <h2 style={{ fontSize: "1.6rem", marginBottom: 16 }}>Shop</h2>
          <div
            style={
              {
                textAlign: "left",
                // CraftPanel's border/description colors are tuned for the
                // app's dark background — override them locally so they stay
                // legible against this box's light, tile-colored fill.
                "--line": "rgba(11, 15, 20, 0.25)",
                "--ink-soft": "rgba(11, 15, 20, 0.65)",
              } as React.CSSProperties
            }
          >
            <CraftPanel
              upgrades={upgrades}
              playerFaces={diceFaces}
              commonResource={player.commonResource}
              rareResource={player.rareResource}
            />
          </div>
        </section>
      ) : (
        <section style={activeBoxStyle}>
          <h2 style={{ fontSize: "1.6rem", marginBottom: 12 }}>Race</h2>
          <p style={{ fontSize: "1.2rem" }}>
            {pendingRoute
              ? "Choose your path on the board below."
              : isMyTurn
                ? "Roll the Dicemaster in the game!"
                : "Wait for your turn…"}
          </p>
        </section>
      )}

      <h2 style={{ marginTop: 32 }}>Board</h2>
      <RaceMap />
    </main>
  );
}
