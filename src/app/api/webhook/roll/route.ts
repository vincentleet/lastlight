import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { diceFaceDefaults, players, playerDiceFaces, races, rollEvents, tileEdges, tiles } from "@/lib/db/schema";

type RollBody =
  | { action: "roll"; value: number }
  | { action: "skip" }
  | { action: "undo" };

function isAuthorized(request: Request): boolean {
  const token = process.env.STREAM_DECK_WEBHOOK_TOKEN;
  if (!token) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expected = Buffer.from(token);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function getActiveRaceAndPlayer() {
  const [race] = await db.select().from(races).where(eq(races.status, "active")).limit(1);
  if (!race || race.currentTurnIndex === null) return { race: null, player: null };

  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.raceId, race.id), eq(players.turnOrderIndex, race.currentTurnIndex)))
    .limit(1);

  return { race, player: player ?? null };
}

async function advanceTurn(raceId: string, currentIndex: number) {
  const roster = await db
    .select({ turnOrderIndex: players.turnOrderIndex })
    .from(players)
    .where(eq(players.raceId, raceId))
    .orderBy(players.turnOrderIndex);

  if (roster.length === 0) return;

  const indexes = roster.map((p) => p.turnOrderIndex);
  const position = indexes.indexOf(currentIndex);
  const nextIndex = indexes[(position + 1) % indexes.length];

  await db.update(races).set({ currentTurnIndex: nextIndex }).where(eq(races.id, raceId));
}

type LandingEffect = { effectType: string; magnitude: number; resourceType?: string };

// "unknown" tiles pick one outcome at random from an authored pool; every
// other tile type (if it has effectConfig at all) applies a single fixed
// effect deterministically.
function pickLandingEffect(tile: { tileType: string; effectConfig: unknown }): LandingEffect | null {
  const config = tile.effectConfig as { pool?: LandingEffect[] } & Partial<LandingEffect>;
  if (!config) return null;

  if (tile.tileType === "unknown") {
    const pool = config.pool;
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return config.effectType ? { effectType: config.effectType, magnitude: config.magnitude ?? 0, resourceType: config.resourceType } : null;
}

async function applyLandingEffect(playerId: string, effect: LandingEffect | null) {
  if (!effect || effect.effectType !== "grant_resource" || !effect.resourceType) return;

  const column = effect.resourceType === "rare" ? "rareResource" : "commonResource";
  const [target] = await db.select().from(players).where(eq(players.id, playerId));
  if (!target) return;

  const current = column === "rareResource" ? target.rareResource : target.commonResource;
  await db
    .update(players)
    .set({ [column]: current + effect.magnitude })
    .where(eq(players.id, playerId));
}

// Walks the tile graph `steps` hops from `fromTileId`. Stops early at a
// branch (>1 outgoing edge) or a dead end — branch route choice happens on
// the player's web UI (a follow-up endpoint, not built in this scaffold),
// not automatically here.
async function walkMovement(fromTileId: string, steps: number) {
  let currentTileId = fromTileId;
  let remaining = steps;
  let pendingRoute = false;

  while (remaining > 0) {
    const edges = await db.select().from(tileEdges).where(eq(tileEdges.fromTileId, currentTileId));

    if (edges.length === 0) break;
    if (edges.length > 1) {
      pendingRoute = true;
      break;
    }

    currentTileId = edges[0].toTileId;
    remaining -= 1;
  }

  return { finalTileId: currentTileId, remainingSteps: remaining, pendingRoute };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RollBody | null;
  if (!body || !["roll", "skip", "undo"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { race, player } = await getActiveRaceAndPlayer();
  if (!race) {
    return NextResponse.json({ error: "No active race" }, { status: 404 });
  }
  if (!player) {
    return NextResponse.json({ error: "No player at the current turn index" }, { status: 409 });
  }

  if (body.action === "undo") {
    const [lastEvent] = await db
      .select()
      .from(rollEvents)
      .where(and(eq(rollEvents.raceId, race.id), eq(rollEvents.status, "resolved")))
      .orderBy(desc(rollEvents.createdAt))
      .limit(1);

    if (!lastEvent) {
      return NextResponse.json({ error: "Nothing to undo" }, { status: 409 });
    }

    const effect = lastEvent.resolvedEffect as Record<string, unknown> | null;
    if (effect?.type === "move" && typeof effect.fromTileId === "string") {
      await db
        .update(players)
        .set({ currentTileId: effect.fromTileId })
        .where(eq(players.id, lastEvent.playerId));

      const landingEffect = effect.landingEffect as LandingEffect | null;
      if (landingEffect?.effectType === "grant_resource" && landingEffect.resourceType) {
        const column = landingEffect.resourceType === "rare" ? "rareResource" : "commonResource";
        const [target] = await db.select().from(players).where(eq(players.id, lastEvent.playerId));
        if (target) {
          const current = column === "rareResource" ? target.rareResource : target.commonResource;
          await db
            .update(players)
            .set({ [column]: Math.max(0, current - landingEffect.magnitude) })
            .where(eq(players.id, lastEvent.playerId));
        }
      }
    } else if (effect?.type === "grant_resource" && typeof effect.magnitude === "number") {
      const column = effect.resourceType === "rare" ? "rareResource" : "commonResource";
      const [target] = await db.select().from(players).where(eq(players.id, lastEvent.playerId));
      if (target) {
        const current = column === "rareResource" ? target.rareResource : target.commonResource;
        await db
          .update(players)
          .set({ [column]: Math.max(0, current - effect.magnitude) })
          .where(eq(players.id, lastEvent.playerId));
      }
    }

    const [undonePlayer] = await db.select().from(players).where(eq(players.id, lastEvent.playerId));

    await db
      .update(rollEvents)
      .set({ status: "undone", undoneAt: new Date() })
      .where(eq(rollEvents.id, lastEvent.id));

    if (undonePlayer) {
      await db
        .update(races)
        .set({ currentTurnIndex: undonePlayer.turnOrderIndex })
        .where(eq(races.id, race.id));
    }

    return NextResponse.json({ undone: lastEvent.id });
  }

  if (body.action === "skip") {
    await db.insert(rollEvents).values({
      raceId: race.id,
      playerId: player.id,
      rollValue: null,
      effectType: null,
      resolvedEffect: { skipped: true },
      status: "resolved",
    });

    await advanceTurn(race.id, player.turnOrderIndex);
    return NextResponse.json({ skipped: player.id });
  }

  // action === "roll"
  const { value } = body;
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    return NextResponse.json({ error: "value must be an integer 1-6" }, { status: 400 });
  }

  const [playerFace] = await db
    .select()
    .from(playerDiceFaces)
    .where(and(eq(playerDiceFaces.playerId, player.id), eq(playerDiceFaces.faceValue, value)));

  const face =
    playerFace ??
    (
      await db
        .select()
        .from(diceFaceDefaults)
        .where(and(eq(diceFaceDefaults.raceId, race.id), eq(diceFaceDefaults.faceValue, value)))
    )[0];

  if (!face) {
    return NextResponse.json({ error: `No dice face configured for value ${value}` }, { status: 409 });
  }

  if (face.effectType === "move") {
    if (!player.currentTileId) {
      return NextResponse.json({ error: "Player has no starting tile set" }, { status: 409 });
    }

    const { finalTileId, remainingSteps, pendingRoute } = await walkMovement(
      player.currentTileId,
      face.magnitude
    );

    await db.update(players).set({ currentTileId: finalTileId }).where(eq(players.id, player.id));

    if (pendingRoute) {
      await db.insert(rollEvents).values({
        raceId: race.id,
        playerId: player.id,
        rollValue: value,
        effectType: face.effectType,
        resolvedEffect: {
          type: "move",
          fromTileId: player.currentTileId,
          reachedTileId: finalTileId,
          remainingSteps,
        },
        status: "pending_route",
      });

      // Turn pointer intentionally not advanced — the player must pick a
      // route on their web UI before this turn finishes resolving.
      return NextResponse.json({ pendingRoute: true, tileId: finalTileId });
    }

    const [landedTile] = await db.select().from(tiles).where(eq(tiles.id, finalTileId));
    const landingEffect = landedTile && landedTile.tileType !== "checkpoint" ? pickLandingEffect(landedTile) : null;
    await applyLandingEffect(player.id, landingEffect);

    await db.insert(rollEvents).values({
      raceId: race.id,
      playerId: player.id,
      rollValue: value,
      effectType: face.effectType,
      resolvedEffect: {
        type: "move",
        fromTileId: player.currentTileId,
        toTileId: finalTileId,
        magnitude: face.magnitude,
        landingEffect,
      },
      status: "resolved",
    });

    if (landedTile?.tileType === "checkpoint") {
      await db
        .update(races)
        .set({ status: "completed", winnerId: player.id, completedAt: new Date() })
        .where(eq(races.id, race.id));
      await db.update(players).set({ status: "finished" }).where(eq(players.id, player.id));
      return NextResponse.json({ winner: player.id });
    }

    await advanceTurn(race.id, player.turnOrderIndex);
    return NextResponse.json({ resolved: "move", tileId: finalTileId, landingEffect });
  }

  if (face.effectType === "grant_resource") {
    const column = face.resourceType === "rare" ? "rareResource" : "commonResource";
    const current = column === "rareResource" ? player.rareResource : player.commonResource;

    await db
      .update(players)
      .set({ [column]: current + face.magnitude })
      .where(eq(players.id, player.id));

    await db.insert(rollEvents).values({
      raceId: race.id,
      playerId: player.id,
      rollValue: value,
      effectType: face.effectType,
      resolvedEffect: { type: "grant_resource", resourceType: face.resourceType, magnitude: face.magnitude },
      status: "resolved",
    });

    await advanceTurn(race.id, player.turnOrderIndex);
    return NextResponse.json({ resolved: "grant_resource" });
  }

  if (face.effectType === "steal_resource" || face.effectType === "block_player") {
    // TODO: build the target-selection endpoint + timeout auto-random
    // fallback described in the design doc. This just parks the event.
    await db.insert(rollEvents).values({
      raceId: race.id,
      playerId: player.id,
      rollValue: value,
      effectType: face.effectType,
      resolvedEffect: { type: face.effectType, magnitude: face.magnitude, resourceType: face.resourceType },
      status: "pending_target",
    });

    return NextResponse.json({ pendingTarget: true, effectType: face.effectType });
  }

  // reroll / skip_hazard / noop: logged, no state mutation beyond the log yet.
  await db.insert(rollEvents).values({
    raceId: race.id,
    playerId: player.id,
    rollValue: value,
    effectType: face.effectType,
    resolvedEffect: { type: face.effectType },
    status: "resolved",
  });

  await advanceTurn(race.id, player.turnOrderIndex);
  return NextResponse.json({ resolved: face.effectType });
}
