import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { players, rollEvents, tileEdges, tiles } from "@/lib/db/schema";
import { getPlayerSession } from "@/lib/auth/player-session";
import { getRouteOptions } from "@/lib/game/roll-resolution";

// Assigns each tile a column (longest-path depth from any root tile) and a
// row (position within its column), so the client can lay the graph out as
// a Slay the Spire-style node map without needing authored coordinates.
function computeLayout(tileIds: string[], edges: Array<{ fromTileId: string; toTileId: string }>) {
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();
  for (const id of tileIds) {
    outgoing.set(id, []);
    incomingCount.set(id, 0);
  }
  for (const edge of edges) {
    outgoing.get(edge.fromTileId)?.push(edge.toTileId);
    incomingCount.set(edge.toTileId, (incomingCount.get(edge.toTileId) ?? 0) + 1);
  }

  const depth = new Map<string, number>();
  const remaining = new Map(incomingCount);
  const queue: string[] = [];
  for (const id of tileIds) {
    if ((remaining.get(id) ?? 0) === 0) {
      queue.push(id);
      depth.set(id, 0);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(id) ?? 0) + 1));
      const rem = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, rem);
      if (rem === 0) queue.push(next);
    }
  }

  const columns = new Map<number, string[]>();
  for (const id of order) {
    const d = depth.get(id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(id);
  }

  const row = new Map<string, number>();
  for (const ids of columns.values()) {
    ids.forEach((id, i) => row.set(id, i));
  }

  return tileIds.map((id) => ({ id, depth: depth.get(id) ?? 0, row: row.get(id) ?? 0 }));
}

export async function GET() {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [player] = await db.select().from(players).where(eq(players.id, session.playerId));
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const raceTiles = await db.select().from(tiles).where(eq(tiles.raceId, player.raceId));
  const tileIds = raceTiles.map((t) => t.id);

  const allEdges = await db.select().from(tileEdges);
  const raceEdges = allEdges.filter(
    (edge) => tileIds.includes(edge.fromTileId) && tileIds.includes(edge.toTileId)
  );

  const layout = computeLayout(tileIds, raceEdges);
  const layoutById = new Map(layout.map((l) => [l.id, l]));

  const [pending] = await db
    .select()
    .from(rollEvents)
    .where(and(eq(rollEvents.playerId, player.id), eq(rollEvents.status, "pending_route")))
    .orderBy(desc(rollEvents.createdAt))
    .limit(1);

  const pendingEffect = pending?.resolvedEffect as { reachedTileId: string } | undefined;
  const pendingOptions = pendingEffect ? await getRouteOptions(pendingEffect.reachedTileId) : [];

  return NextResponse.json({
    currentTileId: player.currentTileId,
    pendingRouteOptions: pendingOptions.map((option) => option.tileId),
    tiles: raceTiles.map((tile) => {
      const { depth, row } = layoutById.get(tile.id)!;
      return { id: tile.id, tileType: tile.tileType, label: tile.label, depth, row };
    }),
    edges: raceEdges.map((edge) => ({
      fromTileId: edge.fromTileId,
      toTileId: edge.toTileId,
      routeLabel: edge.routeLabel,
    })),
  });
}
