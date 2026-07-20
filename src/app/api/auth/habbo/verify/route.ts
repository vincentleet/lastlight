import { NextResponse } from "next/server";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, races } from "@/lib/db/schema";
import { verifyMotto } from "@/lib/habbo/motto";
import { mintPlayerSession } from "@/lib/auth/player-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { habboUsername?: string } | null;
  const habboUsername = body?.habboUsername?.trim();

  if (!habboUsername) {
    return NextResponse.json({ error: "habboUsername is required" }, { status: 400 });
  }

  const [player] = await db
    .select({ id: players.id, habboUsername: players.habboUsername, verificationCode: players.verificationCode })
    .from(players)
    .innerJoin(races, eq(races.id, players.raceId))
    .where(and(ilike(players.habboUsername, habboUsername), inArray(races.status, ["setup", "active"])))
    .limit(1);

  if (!player || !player.verificationCode || !player.habboUsername) {
    return NextResponse.json(
      { error: "No pending verification for that Habbo username" },
      { status: 404 }
    );
  }

  const verified = await verifyMotto(player.habboUsername, player.verificationCode);
  if (!verified) {
    return NextResponse.json(
      { error: "Motto doesn't match yet — set it in-game and try again" },
      { status: 409 }
    );
  }

  await db
    .update(players)
    .set({ verifiedAt: new Date(), authMethod: "habbo_motto", verificationCode: null })
    .where(eq(players.id, player.id));

  await mintPlayerSession(player.id);

  return NextResponse.json({ success: true });
}
