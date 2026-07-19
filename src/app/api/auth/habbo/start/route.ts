import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, races } from "@/lib/db/schema";
import { generateVerificationCode } from "@/lib/habbo/motto";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { habboUsername?: string } | null;
  const habboUsername = body?.habboUsername?.trim();

  if (!habboUsername) {
    return NextResponse.json({ error: "habboUsername is required" }, { status: 400 });
  }

  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .innerJoin(races, eq(races.id, players.raceId))
    .where(and(eq(players.habboUsername, habboUsername), inArray(races.status, ["setup", "active"])))
    .limit(1);

  if (!player) {
    return NextResponse.json(
      { error: "No roster entry found for that Habbo username in the current race" },
      { status: 404 }
    );
  }

  const code = generateVerificationCode();
  await db.update(players).set({ verificationCode: code }).where(eq(players.id, player.id));

  return NextResponse.json({ code });
}
