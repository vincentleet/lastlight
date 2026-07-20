import type { EffectType, ResourceType, TileType } from "../../src/lib/db/schema";

export const exampleRoster = [
  { turnOrderIndex: 0, habboUsername: "TestPlayerOne" },
  { turnOrderIndex: 1, habboUsername: "TestPlayerTwo" },
];

type LandingEffect = { effectType: EffectType; magnitude: number; resourceType?: ResourceType };

// A small Slay the Spire-style board: any tile can branch directly (no
// dedicated junction tiles) — start -> a random event that forks into an
// elite or treasure route -> both merge back at a merchant -> one more
// encounter -> checkpoint.
export const exampleTiles: Array<{
  key: string;
  tileType: TileType;
  label: string;
  effectConfig?: { pool: LandingEffect[] } | LandingEffect;
}> = [
  { key: "start", tileType: "rest", label: "Start" },
  {
    key: "event-1",
    tileType: "unknown",
    label: "Mystery event",
    effectConfig: {
      pool: [
        { effectType: "grant_resource", magnitude: 2, resourceType: "common" },
        { effectType: "grant_resource", magnitude: 1, resourceType: "rare" },
        { effectType: "noop", magnitude: 0 },
      ],
    },
  },
  { key: "risky", tileType: "elite", label: "Elite fight" },
  {
    key: "safe",
    tileType: "treasure",
    label: "Treasure",
    effectConfig: { effectType: "grant_resource", magnitude: 3, resourceType: "common" },
  },
  { key: "merge", tileType: "merchant", label: "Shop" },
  { key: "late", tileType: "enemy", label: "Encounter" },
  { key: "checkpoint", tileType: "checkpoint", label: "Finish line" },
];

export const exampleEdges: Array<{ from: string; to: string; routeLabel?: string }> = [
  { from: "start", to: "event-1" },
  { from: "event-1", to: "risky", routeLabel: "risky" },
  { from: "event-1", to: "safe", routeLabel: "safe" },
  { from: "risky", to: "merge" },
  { from: "safe", to: "merge" },
  { from: "merge", to: "late" },
  { from: "late", to: "checkpoint" },
];

export const exampleDiceFaceDefaults: Array<{
  faceValue: number;
  effectType: EffectType;
  magnitude: number;
  resourceType?: ResourceType;
}> = [
  { faceValue: 1, effectType: "move", magnitude: 1 },
  { faceValue: 2, effectType: "move", magnitude: 2 },
  { faceValue: 3, effectType: "move", magnitude: 3 },
  { faceValue: 4, effectType: "grant_resource", magnitude: 2, resourceType: "common" },
  { faceValue: 5, effectType: "grant_resource", magnitude: 1, resourceType: "rare" },
  { faceValue: 6, effectType: "move", magnitude: 4 },
];
