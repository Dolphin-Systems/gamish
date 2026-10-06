import { ensureSchema, getSql } from "./db.js";
import { GAME_INFO } from "./games.generated.js";
import { HttpError } from "./http.js";
import { LOBBY_SEED } from "./lobby-seed.js";

// The game registry: one row per lobby tile. A row is "playable" when a game with the same id
// exists in code (games/<id>/), otherwise it is a "coming soon" tile. The admin names it,
// gives it a logo, files it under a category, orders it and switches it on or off; the lobby
// shows only the games that are on, and the server refuses rounds of a game that is off.

export const CATEGORIES = ["Slots", "Instant", "Cards", "Table Games", "Numbers", "Arcade", "Quick Games"];
const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_LOGO_BYTES = 200 * 1024;
const LOGO = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

let ready;
// Seeds the table from the old static lobby the first time, and adds any game that exists in
// code but not yet in the table (switched off, so the admin turns it on when it's ready).
export function ensureRegistry() {
  ready ??= (async () => {
    await ensureSchema();
    const sql = getSql();
    const [{ count }] = await sql`SELECT COUNT(*)::INTEGER AS count FROM games`;
    if (count === 0) {
      let sort = 0;
      for (const [id, name, category, cell] of LOBBY_SEED) {
        sort += 10;
        await sql`
          INSERT INTO games (id, name, category, art_cell, enabled, sort)
          VALUES (${id}, ${name}, ${category}, ${cell ? JSON.stringify(cell) : null}::jsonb, TRUE, ${sort})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }
    const [{ max }] = await sql`SELECT COALESCE(MAX(sort), 0)::INTEGER AS max FROM games`;
    let sort = max;
    for (const [id, info] of Object.entries(GAME_INFO)) {
      sort += 10;
      // Games that were already live before the registry existed stay live on first run.
      await sql`
        INSERT INTO games (id, name, category, enabled, sort)
        VALUES (${id}, ${info.title.slice(0, 40)}, ${CATEGORIES.includes(info.category) ? info.category : "Quick Games"}, ${count === 0}, ${sort})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  })().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

const serialize = (row) => {
  const code = GAME_INFO[row.id];
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    enabled: Boolean(row.enabled),
    sort: Number(row.sort),
    kind: code ? "playable" : "coming_soon",
    runtime: code?.runtime ?? null,
    logoUrl: row.logo_mime ? `/api/game/spin?logo=${encodeURIComponent(row.id)}&v=${row.logo_version}` : null,
    artCell: row.art_cell || null,
    updatedAt: row.updated_at,
  };
};

// The lobby: the games that are on, in order.
export async function lobbyGames() {
  await ensureRegistry();
  const rows = await getSql()`
    SELECT id, name, category, art_cell, logo_mime, logo_version, enabled, sort, updated_at
    FROM games WHERE enabled ORDER BY sort, name
  `;
  return rows.map(serialize);
}

export async function adminGames() {
  await ensureRegistry();
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, category, art_cell, logo_mime, logo_version, enabled, sort, updated_at
    FROM games ORDER BY sort, name
  `;
  const stats = await sql`
    SELECT game_id, COUNT(*)::INTEGER AS rounds, COUNT(DISTINCT player_id)::INTEGER AS players
    FROM game_rounds WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY game_id
  `;
  const byId = new Map(stats.map((row) => [row.game_id, row]));
  return rows.map((row) => ({ ...serialize(row), rounds24h: byId.get(row.id)?.rounds ?? 0, players24h: byId.get(row.id)?.players ?? 0 }));
}

export async function isGameEnabled(id) {
  await ensureRegistry();
  const [row] = await getSql()`SELECT enabled FROM games WHERE id = ${id}`;
  return Boolean(row?.enabled);
}

const cleanName = (value) => {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) throw new HttpError(400, "Game names are 2 to 40 characters", "invalid_name");
  return name;
};
const cleanCategory = (value) => {
  if (!CATEGORIES.includes(value)) throw new HttpError(400, `Category must be one of: ${CATEGORIES.join(", ")}`, "invalid_category");
  return value;
};

export async function updateGame(id, input) {
  await ensureRegistry();
  const sql = getSql();
  const [current] = await sql`SELECT * FROM games WHERE id = ${id}`;
  if (!current) throw new HttpError(404, "Unknown game", "unknown_game");
  const name = input.name === undefined ? current.name : cleanName(input.name);
  const category = input.category === undefined ? current.category : cleanCategory(input.category);
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true;
  await sql`UPDATE games SET name = ${name}, category = ${category}, enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`;
}

export async function addGame(input) {
  await ensureRegistry();
  const id = String(input.id ?? "").trim().toLowerCase();
  if (!ID.test(id)) throw new HttpError(400, "IDs are 2 to 40 lowercase letters, digits and dashes", "invalid_id");
  const sql = getSql();
  const [{ max }] = await sql`SELECT COALESCE(MAX(sort), 0)::INTEGER AS max FROM games`;
  const [row] = await sql`
    INSERT INTO games (id, name, category, enabled, sort)
    VALUES (${id}, ${cleanName(input.name)}, ${cleanCategory(input.category)}, FALSE, ${max + 10})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  if (!row) throw new HttpError(409, "A game with that ID already exists", "game_exists");
}

export async function deleteGame(id) {
  await ensureRegistry();
  if (GAME_INFO[id]) throw new HttpError(409, "Playable games live in code and can't be deleted; switch it off instead", "game_in_code");
  const [row] = await getSql()`DELETE FROM games WHERE id = ${id} RETURNING id`;
  if (!row) throw new HttpError(404, "Unknown game", "unknown_game");
}

export async function reorderGames(ids) {
  await ensureRegistry();
  if (!Array.isArray(ids) || ids.length > 500 || ids.some((id) => typeof id !== "string")) throw new HttpError(400, "Invalid order", "invalid_order");
  const sql = getSql();
  for (const [index, id] of ids.entries()) await sql`UPDATE games SET sort = ${(index + 1) * 10} WHERE id = ${id}`;
}

// Logos arrive as small data URLs (the admin page resizes them first) and are checked byte by byte.
export async function setGameLogo(id, dataUrl) {
  await ensureRegistry();
  const sql = getSql();
  if (dataUrl === null) {
    const [row] = await sql`UPDATE games SET logo_mime = NULL, logo_data = NULL, logo_version = logo_version + 1, updated_at = NOW() WHERE id = ${id} RETURNING id`;
    if (!row) throw new HttpError(404, "Unknown game", "unknown_game");
    return;
  }
  const match = LOGO.exec(String(dataUrl || ""));
  if (!match) throw new HttpError(400, "Logos must be PNG, JPEG or WebP images", "invalid_logo");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_LOGO_BYTES) throw new HttpError(413, "Logos must be under 200 KB", "logo_too_large");
  const signature = {
    "image/png": bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    "image/jpeg": bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    "image/webp": bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP",
  }[match[1]];
  if (!signature) throw new HttpError(400, "That file isn't the image type it claims to be", "invalid_logo");
  const [row] = await sql`
    UPDATE games SET logo_mime = ${match[1]}, logo_data = ${match[2]}, logo_version = logo_version + 1, updated_at = NOW()
    WHERE id = ${id} RETURNING id
  `;
  if (!row) throw new HttpError(404, "Unknown game", "unknown_game");
}

export async function getGameLogo(id) {
  await ensureRegistry();
  const [row] = await getSql()`SELECT logo_mime, logo_data FROM games WHERE id = ${id} AND logo_mime IS NOT NULL`;
  if (!row) throw new HttpError(404, "No logo", "no_logo");
  return { mime: row.logo_mime, bytes: Buffer.from(row.logo_data, "base64") };
}
