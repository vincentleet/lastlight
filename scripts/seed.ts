import { config } from "dotenv";

config({ path: ".env.local" });

// Dynamic imports: these modules read process.env at module-load time, so
// they must not load until after dotenv has populated it above.
async function main() {
  const { db } = await import("../src/lib/db/client");
  const { races, tiles, tileEdges, players, diceFaceDefaults, playerDiceFaces, craftableUpgrades } =
    await import("../src/lib/db/schema");
  const {
    exampleRoster,
    exampleTiles,
    exampleEdges,
    exampleDiceFaceDefaults,
    exampleCraftableUpgrades,
  } = await import("./seed-data/example-race");

  console.log("Clearing any existing race (only one race is live at a time)...");
  await db.delete(races);

  console.log("Seeding a test race...");
  const [race] = await db.insert(races).values({ status: "active", currentTurnIndex: 0 }).returning();
  console.log(`Race id: ${race.id}`);

  const tileIdByKey = new Map<string, string>();
  for (const tile of exampleTiles) {
    const [row] = await db
      .insert(tiles)
      .values({
        raceId: race.id,
        tileType: tile.tileType,
        label: tile.label,
        effectConfig: tile.effectConfig ?? null,
      })
      .returning();
    tileIdByKey.set(tile.key, row.id);
    console.log(`  tile "${tile.key}": ${row.id}`);
  }

  for (const edge of exampleEdges) {
    const fromTileId = tileIdByKey.get(edge.from);
    const toTileId = tileIdByKey.get(edge.to);
    if (!fromTileId || !toTileId) {
      throw new Error(`Unknown tile key in edge ${edge.from} -> ${edge.to}`);
    }
    await db.insert(tileEdges).values({ fromTileId, toTileId, routeLabel: edge.routeLabel ?? null });
  }
  console.log(`  ${exampleEdges.length} edges created`);

  const startTileId = tileIdByKey.get("start");
  if (!startTileId) {
    throw new Error('Seed data must include a tile with key "start"');
  }

  const playerIds: string[] = [];
  for (const player of exampleRoster) {
    const [row] = await db
      .insert(players)
      .values({
        raceId: race.id,
        habboUsername: player.habboUsername,
        turnOrderIndex: player.turnOrderIndex,
        currentTileId: startTileId,
        // Starting resources so the shop is testable right away — not real
        // game balance, just seed convenience.
        commonResource: 10,
        rareResource: 3,
      })
      .returning();
    playerIds.push(row.id);
    console.log(`  player "${player.habboUsername}": ${row.id}`);
  }

  for (const face of exampleDiceFaceDefaults) {
    await db.insert(diceFaceDefaults).values({
      raceId: race.id,
      faceValue: face.faceValue,
      effectType: face.effectType,
      magnitude: face.magnitude,
      resourceType: face.resourceType ?? null,
    });
  }
  console.log(`  ${exampleDiceFaceDefaults.length} dice face defaults created`);

  // Every player starts on the same standard dice (the race defaults) —
  // crafting later overwrites individual faces per player.
  for (const playerId of playerIds) {
    for (const face of exampleDiceFaceDefaults) {
      await db.insert(playerDiceFaces).values({
        playerId,
        faceValue: face.faceValue,
        effectType: face.effectType,
        magnitude: face.magnitude,
        resourceType: face.resourceType ?? null,
      });
    }
  }
  console.log(`  starting dice assigned to ${playerIds.length} players`);

  for (const upgrade of exampleCraftableUpgrades) {
    await db.insert(craftableUpgrades).values({
      raceId: race.id,
      name: upgrade.name,
      description: upgrade.description,
      costCommon: upgrade.costCommon,
      costRare: upgrade.costRare,
      effectType: upgrade.effectType,
      magnitude: upgrade.magnitude,
      resourceType: upgrade.resourceType ?? null,
    });
  }
  console.log(`  ${exampleCraftableUpgrades.length} craftable upgrades created`);

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
