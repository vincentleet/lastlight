import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, races, rollEvents, tiles } from "@/lib/db/schema";
import { getPlayerSession } from "@/lib/auth/player-session";
import {
  advanceTurn,
  applyLandingEffect,
  getRouteOptions,
  pickLandingEffect,
  walkMovement,
} from "@/lib/game/roll-resolution";

type PendingMoveEffect = {
  type: "move";
  fromTileId: string;
  reachedTileId: string;
  remainingSteps: number;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// Resolves a branch choice in one step, gated on the room's codeword — a
// fixed, admin-authored word for that tile (e.g. a sign posted there in
// Habbo). Without this check a player could pick one option on the web
// while physically walking somewhere else in-game.
export async function POST(request: Request) {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { toTileId?: string; code?: string } | null;
  const toTileId = body?.toTileId;
  const code = body?.code;
  if (!toTileId || !code) {
    return NextResponse.json({ error: "toTileId and code are required" }, { status: 400 });
  }

  const [player] = await db.select().from(players).where(eq(players.id, session.playerId));
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const [pending] = await db
    .select()
    .from(rollEvents)
    .where(and(eq(rollEvents.playerId, player.id), eq(rollEvents.status, "pending_route")))
    .orderBy(desc(rollEvents.createdAt))
    .limit(1);

  if (!pending) {
    return NextResponse.json({ error: "No pending route choice" }, { status: 409 });
  }

  const effect = pending.resolvedEffect as PendingMoveEffect;
  const options = await getRouteOptions(effect.reachedTileId);
  const chosen = options.find((option) => option.tileId === toTileId);
  if (!chosen) {
    return NextResponse.json({ error: "That isn't a valid option from here" }, { status: 400 });
  }

  const [destinationTile] = await db.select().from(tiles).where(eq(tiles.id, toTileId));
  if (destinationTile?.codeword && normalizeCode(destinationTile.codeword) !== normalizeCode(code)) {
    return NextResponse.json({ error: "Wrong codeword for that room — try again" }, { status: 409 });
  }

  // The hop onto the chosen tile consumes one of the steps left over from
  // the original roll; whatever's left keeps walking from there.
  const { finalTileId, remainingSteps, pendingRoute } = await walkMovement(
    toTileId,
    Math.max(0, effect.remainingSteps - 1)
  );

  await db.update(players).set({ currentTileId: finalTileId }).where(eq(players.id, player.id));

  if (pendingRoute) {
    await db
      .update(rollEvents)
      .set({
        resolvedEffect: {
          type: "move",
          fromTileId: effect.fromTileId,
          reachedTileId: finalTileId,
          remainingSteps,
        } satisfies PendingMoveEffect,
      })
      .where(eq(rollEvents.id, pending.id));

    return NextResponse.json({
      pendingRoute: true,
      tileId: finalTileId,
      options: await getRouteOptions(finalTileId),
    });
  }

  const [landedTile] = await db.select().from(tiles).where(eq(tiles.id, finalTileId));
  const landingEffect = landedTile && landedTile.tileType !== "checkpoint" ? pickLandingEffect(landedTile) : null;
  await applyLandingEffect(player.id, landingEffect);

  await db
    .update(rollEvents)
    .set({
      status: "resolved",
      resolvedEffect: {
        type: "move",
        fromTileId: effect.fromTileId,
        toTileId: finalTileId,
        landingEffect,
      },
    })
    .where(eq(rollEvents.id, pending.id));

  if (landedTile?.tileType === "checkpoint") {
    await db
      .update(races)
      .set({ status: "completed", winnerId: player.id, completedAt: new Date() })
      .where(eq(races.id, pending.raceId));
    await db.update(players).set({ status: "finished" }).where(eq(players.id, player.id));
    return NextResponse.json({ winner: player.id });
  }

  await advanceTurn(pending.raceId, player.turnOrderIndex);
  return NextResponse.json({ resolved: true, tileId: finalTileId, landingEffect });
}
