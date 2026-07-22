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
  // A fixed word for this room — a sign posted there in Habbo, or something
  // the host tells arriving players. Only branch destinations strictly need
  // one, but every tile has one here for consistency.
  codeword: string;
  effectConfig?: { pool: LandingEffect[] } | LandingEffect;
}> = [
  { key: "start", tileType: "rest", label: "Start", codeword: "CAMPFIRE" },
  {
    key: "event-1",
    tileType: "unknown",
    label: "Mystery event",
    codeword: "SHADOWS",
    effectConfig: {
      pool: [
        { effectType: "grant_resource", magnitude: 2, resourceType: "common" },
        { effectType: "grant_resource", magnitude: 1, resourceType: "rare" },
        { effectType: "noop", magnitude: 0 },
      ],
    },
  },
  { key: "risky", tileType: "elite", label: "Elite fight", codeword: "IRONFIST" },
  {
    key: "safe",
    tileType: "treasure",
    label: "Treasure",
    codeword: "GOLDRUSH",
    effectConfig: { effectType: "grant_resource", magnitude: 3, resourceType: "common" },
  },
  { key: "merge", tileType: "merchant", label: "Shop", codeword: "BAZAAR" },
  { key: "late", tileType: "enemy", label: "Encounter", codeword: "AMBUSH" },
  { key: "checkpoint", tileType: "checkpoint", label: "Finish line", codeword: "SUNRISE" },
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

// Shop catalog: swappable dice-face effects. Face-agnostic — the player
// picks which of their 6 slots to install one into (see /race craft panel).
export const exampleCraftableUpgrades: Array<{
  name: string;
  description: string;
  costCommon: number;
  costRare: number;
  effectType: EffectType;
  magnitude: number;
  resourceType?: ResourceType;
}> = [
  {
    name: "Quick Step",
    description: "Move 1 block further.",
    costCommon: 2,
    costRare: 0,
    effectType: "move",
    magnitude: 1,
  },
  {
    name: "Sprint",
    description: "Move 2 blocks further.",
    costCommon: 4,
    costRare: 0,
    effectType: "move",
    magnitude: 2,
  },
  {
    name: "Lucky Find",
    description: "Gain 1 coin.",
    costCommon: 1,
    costRare: 0,
    effectType: "grant_resource",
    magnitude: 1,
    resourceType: "common",
  },
  {
    name: "Big Score",
    description: "Gain 2 coins.",
    costCommon: 3,
    costRare: 0,
    effectType: "grant_resource",
    magnitude: 2,
    resourceType: "common",
  },
  {
    name: "Gem Vein",
    description: "Gain 1 rare resource.",
    costCommon: 3,
    costRare: 1,
    effectType: "grant_resource",
    magnitude: 1,
    resourceType: "rare",
  },
  {
    name: "Wildcard",
    description: "Trigger a special event.",
    costCommon: 5,
    costRare: 1,
    effectType: "special_event",
    magnitude: 0,
  },
];
