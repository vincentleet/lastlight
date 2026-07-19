import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, races } from "@/lib/db/schema";

export async function GET() {
  const [race] = await db.select().from(races).orderBy(desc(races.createdAt)).limit(1);

  const roster = race
    ? await db
        .select()
        .from(players)
        .where(eq(players.raceId, race.id))
        .orderBy(players.turnOrderIndex)
    : [];

  return NextResponse.json({ race, roster });
}
