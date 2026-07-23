# Last Light

A rogue-lite PvP dice race hosted on Habbo Origins. Players roll physical dice in-game;
a host relays the result via a Stream Deck webhook. This app tracks race state, resources,
dice crafting, and drives a player web UI, an admin panel, and an OBS stream overlay.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Drizzle ORM · Railway.

This is a standalone project — it does not share a Supabase project, database, or any
other infrastructure with the Leet Show / Popcorn economy codebase or with Backstreet
Mysteries.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In **Project Settings → Database → Connection string**, copy:
   - The **pooled** connection (Transaction mode, port `6543`) → `DATABASE_URL`
   - The **direct** connection (port `5432`) → `DIRECT_URL`
4. In **Authentication → Providers**, enable **Discord** and fill in a Discord OAuth
   app's client ID/secret (create one at the
   [Discord Developer Portal](https://discord.com/developers/applications); redirect URL
   is `<your Supabase project URL>/auth/v1/callback`).
5. In **Database → Replication**, enable replication on the `races`, `players`, and
   `player_dice_faces` tables — the stream overlay subscribes to these via Supabase
   Realtime.

Copy `.env.example` to `.env.local` and fill in all values. `ADMIN_DISCORD_IDS` is a
comma-separated list of Discord user IDs allowed into `/admin` — anyone else who signs in
with Discord gets bounced back to the login page. `STREAM_DECK_WEBHOOK_TOKEN` and
`PLAYER_SESSION_SECRET` can both be generated with `openssl rand -hex 32`.

`HABBO_API_BASE_URL` is a confirmed, working endpoint (`https://origins.habbo.com/api/public`)
— `GET {this}/users?name=<username>` returns `{ motto, profileVisible, ... }`, 404s for a
username that doesn't exist. See `src/lib/habbo/motto.ts`.

## 2. Set up the database

```bash
npm install
npm run db:push    # creates the tables in your Supabase Postgres
```

`db:push` applies the schema directly (fast iteration). Switch to `npm run db:generate` +
a proper migration workflow once the schema stabilizes.

There's no admin UI yet for creating a race/roster/board — see "What's deliberately not
built yet" below. For now:

```bash
npm run db:seed    # wipes any existing race and creates the example test race
```

Edit `scripts/seed-data/example-race.ts` to swap in a real roster/board/dice defaults for
an actual event. `npm run db:studio` also works for one-off manual edits.

## 3. Run it locally

```bash
npm run dev
```

- Landing: [http://localhost:3000](http://localhost:3000)
- Player interface: [http://localhost:3000/race](http://localhost:3000/race) — verifies via
  Habbo motto (a one-time code the player sets as their in-game motto). Once verified, shows
  the player's real Habbo avatar (`https://www.habbo.com/habbo-imaging/avatarimage`, fed by
  `players.figure_string` captured at verification time — not kept live-synced). The page's
  main box is contextual: titled with the current tile's name (e.g. "Clearing") and colored
  to match its type (green at a Rest tile, gold at a Merchant, etc. — see `TILE_STYLE`),
  showing turn/path guidance normally or the shop panel when standing on a Merchant tile. Any
  tile directly connected to the player's position is clickable on the board for a same-style
  preview (read-only, with that tile's flavor text) — except tiles that are an actual pending
  route decision, which show the codeword form right there instead of a description.
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin) — Discord OAuth,
  restricted to `ADMIN_DISCORD_IDS`.
- Stream overlay (OBS browser source):
  [http://localhost:3000/overlay](http://localhost:3000/overlay) — transparent background,
  live via Supabase Realtime.

## 4. Stream Deck / Companion webhook

Configure a Stream Deck plugin or [Bitfocus Companion](https://bitfocus.io/companion) button
per die face (1–6) plus skip/undo, each firing:

```
POST /api/webhook/roll
Authorization: Bearer <STREAM_DECK_WEBHOOK_TOKEN>
Content-Type: application/json

{"action": "roll", "value": 4}   // or {"action": "skip"} / {"action": "undo"}
```

The active player is resolved from the fixed turn order — no player selection needed on
the Stream Deck itself.

## 5. Dice crafting

Each player has 6 fixed-numbered dice faces (`player_dice_faces`), seeded from the race's
defaults at start. The roll a face produces is permanent — 1 always means "face 1" — but
the *effect* behind each face is swappable. `craftable_upgrades` is the shop catalog of
effects a player can buy — self-service on `/race`, not gated by turn order, but **gated by
board position**: the Shop section only renders (and `POST /api/race/craft` only accepts
purchases) while the player's `currentTileId` is a `merchant` tile. Buying an upgrade lets
them pick which of their 6 slots it overwrites. The active player's current 6 effects show
on the stream overlay whenever it's their turn.

## 6. Branch route choice

When a roll's movement would carry a player past a tile with more than one outgoing edge,
the webhook stops them there and marks the roll `pending_route` instead of guessing. The
board on `/race` (`race-map.tsx`) rings the reachable next tiles — clicking one directly on
the map reveals an inline "codeword for this room" box positioned right under that node.

Each room (`tiles.codeword`) has a fixed word set at board-authoring time — a sign posted
in that room in Habbo, or something you tell arriving players. `POST /api/race/choose-route`
only resolves the move (position updates, turn advances) if the submitted word matches that
tile's codeword — wrong word, no movement, they can just retry. This is deliberate: without
that check, a player could click one option on the web while physically walking somewhere
else in-game, and there'd be no way to catch the mismatch. If the remaining movement crosses
another branch after confirming, the map just re-highlights the next set of reachable tiles,
still within the same roll. Tiles without a `codeword` skip the check entirely (useful for tiles
that are never branch destinations).

## 7. Deploy

1. Push this repo to GitHub.
2. Create a [Railway](https://railway.app) project, add this repo as a service.
3. Add the same environment variables from `.env.local`.
4. Deploy. Point the Discord OAuth app's redirect URL and Supabase's site URL at the
   deployed domain once you have one.

## What's deliberately not built yet

- **Boss fight mechanics** — not designed. `boss_fight_attempts` exists in the schema but
  nothing writes to it yet.
- **Targeted effects** (steal/block) — the webhook parks these as `pending_target` events;
  there's no target-picker UI or auto-random timeout fallback yet.
- **Admin authoring UI** — no UI for creating a race, roster, board layout, dice defaults,
  shop, or crafting catalog. Use `npm run db:seed` (edit `scripts/seed-data/example-race.ts`
  first) or `npm run db:studio` for now.
- **Discord OAuth as a player fallback login** — only Habbo motto verification is wired up
  for players; Discord is only implemented for the admin panel so far.
- **Resource and boss-fight naming/theming** — the schema uses generic `common`/`rare`
  resource types; no in-fiction names chosen yet.
- **`special_event` dice effect** — a face/upgrade can be typed `special_event`, and it's
  logged when rolled, but there's no mechanic behind it yet (same as `reroll`/`skip_hazard`)
  — intended for whatever the host wants to improvise, or a future random-pool mechanic
  like the one "unknown" tiles already have.
