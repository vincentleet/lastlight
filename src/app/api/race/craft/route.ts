import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { craftableUpgrades, playerCraftedUpgrades, playerDiceFaces, players, tiles } from "@/lib/db/schema";
import { getPlayerSession } from "@/lib/auth/player-session";

export async function POST(request: Request) {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { craftableUpgradeId?: string; faceValue?: number }
    | null;
  const craftableUpgradeId = body?.craftableUpgradeId;
  const faceValue = body?.faceValue;

  if (!craftableUpgradeId || !Number.isInteger(faceValue) || faceValue! < 1 || faceValue! > 6) {
    return NextResponse.json({ error: "craftableUpgradeId and a faceValue 1-6 are required" }, { status: 400 });
  }

  const [player] = await db.select().from(players).where(eq(players.id, session.playerId));
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const [currentTile] = player.currentTileId
    ? await db.select().from(tiles).where(eq(tiles.id, player.currentTileId))
    : [];
  if (currentTile?.tileType !== "merchant") {
    return NextResponse.json({ error: "You have to be at a Merchant tile to shop" }, { status: 409 });
  }

  const [upgrade] = await db
    .select()
    .from(craftableUpgrades)
    .where(and(eq(craftableUpgrades.id, craftableUpgradeId), eq(craftableUpgrades.raceId, player.raceId)));

  if (!upgrade) {
    return NextResponse.json({ error: "Upgrade not found for this race" }, { status: 404 });
  }

  if (player.commonResource < upgrade.costCommon || player.rareResource < upgrade.costRare) {
    return NextResponse.json({ error: "Not enough resources" }, { status: 409 });
  }

  await db
    .update(players)
    .set({
      commonResource: player.commonResource - upgrade.costCommon,
      rareResource: player.rareResource - upgrade.costRare,
    })
    .where(eq(players.id, player.id));

  await db
    .insert(playerDiceFaces)
    .values({
      playerId: player.id,
      faceValue: faceValue!,
      effectType: upgrade.effectType,
      magnitude: upgrade.magnitude,
      resourceType: upgrade.resourceType,
    })
    .onConflictDoUpdate({
      target: [playerDiceFaces.playerId, playerDiceFaces.faceValue],
      set: { effectType: upgrade.effectType, magnitude: upgrade.magnitude, resourceType: upgrade.resourceType },
    });

  await db.insert(playerCraftedUpgrades).values({
    playerId: player.id,
    craftableUpgradeId: upgrade.id,
    installedFaceValue: faceValue!,
  });

  return NextResponse.json({
    installed: {
      faceValue,
      effectType: upgrade.effectType,
      magnitude: upgrade.magnitude,
      resourceType: upgrade.resourceType,
    },
    remainingCommon: player.commonResource - upgrade.costCommon,
    remainingRare: player.rareResource - upgrade.costRare,
  });
}
