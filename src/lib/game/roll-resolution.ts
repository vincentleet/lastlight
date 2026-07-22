import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, races, tileEdges, tiles } from "@/lib/db/schema";

export type LandingEffect = { effectType: string; magnitude: number; resourceType?: string };

export type RouteOption = {
  tileId: string;
  tileType: string;
  label: string | null;
  routeLabel: string | null;
};

export async function advanceTurn(raceId: string, currentIndex: number) {
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

// "unknown" tiles pick one outcome at random from an authored pool; every
// other tile type (if it has effectConfig at all) applies a single fixed
// effect deterministically.
export function pickLandingEffect(tile: { tileType: string; effectConfig: unknown }): LandingEffect | null {
  const config = tile.effectConfig as { pool?: LandingEffect[] } & Partial<LandingEffect>;
  if (!config) return null;

  if (tile.tileType === "unknown") {
    const pool = config.pool;
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return config.effectType ? { effectType: config.effectType, magnitude: config.magnitude ?? 0, resourceType: config.resourceType } : null;
}

export async function applyLandingEffect(playerId: string, effect: LandingEffect | null) {
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
// the player's web UI (see /api/race/choose-route), not automatically here.
export async function walkMovement(fromTileId: string, steps: number) {
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

// The destination tiles reachable from a branch point, for showing the
// player what's coming up before they choose.
export async function getRouteOptions(fromTileId: string): Promise<RouteOption[]> {
  const edges = await db.select().from(tileEdges).where(eq(tileEdges.fromTileId, fromTileId));
  if (edges.length === 0) return [];

  const destinationTiles = await db
    .select()
    .from(tiles)
    .where(inArray(tiles.id, edges.map((edge) => edge.toTileId)));
  const tileById = new Map(destinationTiles.map((tile) => [tile.id, tile]));

  return edges.map((edge) => {
    const tile = tileById.get(edge.toTileId);
    return {
      tileId: edge.toTileId,
      tileType: tile?.tileType ?? "unknown",
      label: tile?.label ?? null,
      routeLabel: edge.routeLabel,
    };
  });
}
