import { getSessionPlayer, publicPlayer } from "../../lib/auth.js";
import { ensureSchema, getSql } from "../../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { creditPlayer, getWeeklyBonusPool } from "../../lib/ledger.js";
import { hashPin, normalizeLoginId, randomUUID, validateLoginId, validatePin } from "../../lib/security.js";

const MAX_CREDIT = 1_000_000;

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const admin = await getSessionPlayer(req, { role: "admin" });
    await ensureSchema();
    const sql = getSql();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT id, login_id, role, status, regular_credits, bonus_credits, created_at, last_login_at
        FROM players
        ORDER BY created_at DESC
      `;
      return json(res, 200, { players: rows.map(publicPlayer), bonusPool: await getWeeklyBonusPool() });
    }

    requireBrowserAction(req);
    const body = await readJson(req);
    if (body.action === "create") {
      if (!validateLoginId(body.loginId) || !validatePin(body.pin)) {
        throw new HttpError(400, "Use a 5–20 character login ID and a 4–8 digit PIN", "invalid_player_credentials");
      }
      const credentials = await hashPin(body.pin);
      const id = randomUUID();
      try {
        const [row] = await sql`
          INSERT INTO players (id, login_id, login_id_normalized, pin_salt, pin_hash, role)
          VALUES (${id}, ${body.loginId.trim()}, ${normalizeLoginId(body.loginId)}, ${credentials.salt}, ${credentials.hash}, 'player')
          RETURNING *
        `;
        return json(res, 201, { player: publicPlayer(row) });
      } catch (error) {
        if (String(error.message).includes("players_login_id_normalized_key")) {
          throw new HttpError(409, "That login ID already exists", "login_id_exists");
        }
        throw error;
      }
    }

    if (body.action === "credit") {
      const amount = Number(body.amount);
      const balanceType = body.balanceType === "bonus" ? "bonus" : "regular";
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CREDIT) {
        throw new HttpError(400, `Credit must be a whole number from 1 to ${MAX_CREDIT.toLocaleString("en-US")}`, "invalid_credit");
      }
      if (balanceType === "bonus") {
        const pool = await getWeeklyBonusPool();
        if (amount > pool.available) throw new HttpError(409, `Only ${pool.available} bonus credits are currently available`, "bonus_pool_exceeded");
      }
      const result = await creditPlayer({
        playerId: body.playerId,
        regular: balanceType === "regular" ? amount : 0,
        bonus: balanceType === "bonus" ? amount : 0,
        entryType: balanceType === "bonus" ? "bonus_credit" : "admin_credit",
        reference: String(body.reason || "Admin credit").slice(0, 120),
        createdBy: admin.id,
        idempotencyKey: `admin:${randomUUID()}`,
      });
      if (!result.applied) throw new HttpError(404, "Player not found", "player_not_found");
      return json(res, 200, result);
    }

    if (body.action === "reset_pin") {
      if (!validatePin(body.pin)) throw new HttpError(400, "PIN must contain 4–8 digits", "invalid_pin");
      const credentials = await hashPin(body.pin);
      const rows = await sql`
        UPDATE players
        SET pin_salt = ${credentials.salt}, pin_hash = ${credentials.hash}, updated_at = NOW()
        WHERE id = ${body.playerId} AND role = 'player'
        RETURNING id
      `;
      if (!rows.length) throw new HttpError(404, "Player not found", "player_not_found");
      await sql`DELETE FROM sessions WHERE player_id = ${body.playerId}`;
      return json(res, 200, { ok: true });
    }

    if (body.action === "status") {
      if (!["active", "suspended"].includes(body.status)) throw new HttpError(400, "Invalid status", "invalid_status");
      const rows = await sql`
        UPDATE players
        SET status = ${body.status}, updated_at = NOW()
        WHERE id = ${body.playerId} AND role = 'player'
        RETURNING id
      `;
      if (!rows.length) throw new HttpError(404, "Player not found", "player_not_found");
      if (body.status === "suspended") await sql`DELETE FROM sessions WHERE player_id = ${body.playerId}`;
      return json(res, 200, { ok: true });
    }

    throw new HttpError(400, "Unknown admin action", "unknown_action");
  } catch (error) {
    return handleApiError(res, error);
  }
}
