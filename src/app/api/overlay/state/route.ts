import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { playerDiceFaces, players, races } from "@/lib/db/schema";

export async function GET() {
  const [race] = await db.select().from(races).orderBy(desc(races.createdAt)).limit(1);

  const roster = race
    ? await db
        .select()
        .from(players)
        .where(eq(players.raceId, race.id))
        .orderBy(players.turnOrderIndex)
    : [];

  const activePlayer = roster.find((p) => p.turnOrderIndex === race?.currentTurnIndex) ?? null;
  const activePlayerDice = activePlayer
    ? await db.select().from(playerDiceFaces).where(eq(playerDiceFaces.playerId, activePlayer.id))
    : [];

  return NextResponse.json({ race, roster, activePlayerId: activePlayer?.id ?? null, activePlayerDice });
}
