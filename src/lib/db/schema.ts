import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Dice face / crafted-upgrade / roll effects all resolve through this closed
// vocabulary rather than freeform config, so new crafted ideas are data rows,
// not backend deploys.
export const EFFECT_TYPES = [
  "move",
  "grant_resource",
  "reroll",
  "skip_hazard",
  "steal_resource",
  "block_player",
  "noop",
] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export const RESOURCE_TYPES = ["common", "rare"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const races = pgTable("races", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status", { enum: ["setup", "active", "completed"] })
    .notNull()
    .default("setup"),
  // Active player = the player in this race whose turnOrderIndex matches this.
  // Null before the race starts.
  currentTurnIndex: integer("current_turn_index"),
  // Set once a player reaches the checkpoint tile; resolved via lazy reference
  // below since players.raceId points back at races (circular FK).
  winnerId: uuid("winner_id").references((): AnyPgColumn => players.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Node-map vocabulary (Slay the Spire-style): every tile is one of these.
// "unknown" is a random event — effectConfig holds a pool of possible
// outcomes rather than a single fixed effect; see resolveLandingEffect.
export const TILE_TYPES = ["unknown", "merchant", "treasure", "rest", "enemy", "elite", "checkpoint"] as const;
export type TileType = (typeof TILE_TYPES)[number];

export const tiles = pgTable("tiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  tileType: text("tile_type", { enum: TILE_TYPES }).notNull().default("unknown"),
  label: text("label"),
  // Landing-on-this-tile effect. For "unknown" tiles: { pool: Array<{ effectType,
  // magnitude, resourceType? }> } — one entry is picked at random on landing.
  // For every other type: a single { effectType, magnitude, resourceType? },
  // applied deterministically on landing if present (optional — a tile can be
  // purely a content marker with its mechanic handled elsewhere, e.g. "merchant"
  // opening the shop UI rather than an automatic effect).
  effectConfig: jsonb("effect_config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tileEdges = pgTable("tile_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromTileId: uuid("from_tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  toTileId: uuid("to_tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  // e.g. "safe" / "risky" — null on a tile with only one outgoing edge.
  routeLabel: text("route_label"),
});

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    habboUsername: text("habbo_username"),
    discordId: text("discord_id"),
    turnOrderIndex: integer("turn_order_index").notNull(),
    currentTileId: uuid("current_tile_id").references(() => tiles.id),
    commonResource: integer("common_resource").notNull().default(0),
    rareResource: integer("rare_resource").notNull().default(0),
    status: text("status", { enum: ["active", "afk", "finished"] })
      .notNull()
      .default("active"),
    // Habbo motto verification: a one-time code the player sets as their
    // in-game motto, checked against Habbo's public API.
    verificationCode: text("verification_code"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    authMethod: text("auth_method", { enum: ["habbo_motto", "discord"] }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("players_race_turn_order_unique").on(table.raceId, table.turnOrderIndex)]
);

export const diceFaceDefaults = pgTable(
  "dice_face_defaults",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    faceValue: integer("face_value").notNull(),
    effectType: text("effect_type", { enum: EFFECT_TYPES }).notNull(),
    magnitude: integer("magnitude").notNull().default(0),
    resourceType: text("resource_type", { enum: RESOURCE_TYPES }),
  },
  (table) => [unique("dice_face_defaults_race_face_unique").on(table.raceId, table.faceValue)]
);

export const playerDiceFaces = pgTable(
  "player_dice_faces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    faceValue: integer("face_value").notNull(),
    effectType: text("effect_type", { enum: EFFECT_TYPES }).notNull(),
    magnitude: integer("magnitude").notNull().default(0),
    resourceType: text("resource_type", { enum: RESOURCE_TYPES }),
  },
  (table) => [unique("player_dice_faces_player_face_unique").on(table.playerId, table.faceValue)]
);

export const craftableUpgrades = pgTable("craftable_upgrades", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  costCommon: integer("cost_common").notNull().default(0),
  costRare: integer("cost_rare").notNull().default(0),
  targetFaceValue: integer("target_face_value").notNull(),
  effectType: text("effect_type", { enum: EFFECT_TYPES }).notNull(),
  magnitude: integer("magnitude").notNull().default(0),
  resourceType: text("resource_type", { enum: RESOURCE_TYPES }),
  prerequisiteUpgradeId: uuid("prerequisite_upgrade_id").references(
    (): AnyPgColumn => craftableUpgrades.id
  ),
});

export const shopItems = pgTable("shop_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  costCommon: integer("cost_common").notNull().default(0),
  costRare: integer("cost_rare").notNull().default(0),
  effectConfig: jsonb("effect_config"),
  stock: integer("stock"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerPurchases = pgTable("player_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  shopItemId: uuid("shop_item_id")
    .notNull()
    .references(() => shopItems.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

// Immutable log every roll (and skip/undo) is written to. Roll resolution reads
// player_dice_faces and writes here; undo marks the latest row undone and
// reverses its effect rather than mutating player state with no history.
export const rollEvents = pgTable("roll_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  // Set once a targeted effect (steal/block) resolves who it applies to.
  targetPlayerId: uuid("target_player_id").references(() => players.id),
  rollValue: integer("roll_value"), // null for a skip-turn event
  effectType: text("effect_type", { enum: EFFECT_TYPES }),
  resolvedEffect: jsonb("resolved_effect"),
  status: text("status", {
    enum: ["resolved", "pending_target", "pending_route", "undone"],
  })
    .notNull()
    .default("resolved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
});

export const bossFightAttempts = pgTable("boss_fight_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  baseOdds: integer("base_odds").notNull(),
  modifiersApplied: jsonb("modifiers_applied"),
  rollValue: integer("roll_value"),
  outcome: text("outcome", { enum: ["pending", "win", "lose"] })
    .notNull()
    .default("pending"),
  jackpotAwarded: boolean("jackpot_awarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// One-off, non-persistent — does not bank into any future race.
export const consolationAwards = pgTable("consolation_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .references(() => races.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
});
