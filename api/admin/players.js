import { getSessionPlayer, publicPlayer } from "../../lib/auth.js";
import { ensureSchema, getSql } from "../../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { creditPlayer, getWeeklyBonusPool, resetPlayerBalance } from "../../lib/ledger.js";
import { hashPin, normalizeLoginId, randomUUID, validateLoginId, validatePin } from "../../lib/security.js";

const MAX_CREDIT = 1_000_000;
const formatMoney = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const admin = await getSessionPlayer(req, { role: "admin" });
    await ensureSchema();
    const sql = getSql();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT
          p.id, p.login_id, p.role, p.status, p.regular_credits, p.bonus_credits,
          p.created_at, p.last_login_at, p.deleted_at,
          COALESCE(SUM(CASE
            WHEN l.entry_type = 'payment_credit' THEN l.cash_cents
            WHEN l.entry_type = 'admin_credit' THEN GREATEST(l.regular_delta, 0)
            ELSE 0
          END), 0) AS lifetime_cash_in_cents,
          COALESCE(SUM(CASE WHEN l.entry_type = 'withdrawal' THEN ABS(l.cash_cents) ELSE 0 END), 0) AS lifetime_cash_out_cents
        FROM players p
        LEFT JOIN ledger_entries l ON l.player_id = p.id
        GROUP BY p.id
        ORDER BY p.deleted_at NULLS FIRST, p.created_at DESC
      `;
      return json(res, 200, {
        players: rows.map((row) => ({
          ...publicPlayer(row),
          createdAt: row.created_at,
          lastLoginAt: row.last_login_at,
          deletedAt: row.deleted_at,
          lifetimeCashInCents: Number(row.lifetime_cash_in_cents),
          lifetimeCashOutCents: Number(row.lifetime_cash_out_cents),
        })),
        bonusPool: await getWeeklyBonusPool(),
      });
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
      const amount = Number(body.amountCents ?? body.amount);
      const balanceType = body.balanceType === "bonus" ? "bonus" : "regular";
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CREDIT) {
        throw new HttpError(400, "Amount must be from $0.01 to $10,000.00", "invalid_amount");
      }
      if (balanceType === "bonus") {
        const pool = await getWeeklyBonusPool();
        if (amount > pool.available) throw new HttpError(409, `Only ${formatMoney(pool.available)} in bonus cash is currently available`, "bonus_pool_exceeded");
      }
      const result = await creditPlayer({
        playerId: body.playerId,
        regular: balanceType === "regular" ? amount : 0,
        bonus: balanceType === "bonus" ? amount : 0,
        entryType: balanceType === "bonus" ? "bonus_credit" : "admin_credit",
        reference: String(body.reason || "Admin funding").slice(0, 120),
        createdBy: admin.id,
        idempotencyKey: `admin:${randomUUID()}`,
      });
      if (!result.applied) throw new HttpError(404, "Player not found", "player_not_found");
      return json(res, 200, result);
    }

    if (body.action === "cashout") {
      const amount = Number(body.amountCents);
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CREDIT) {
        throw new HttpError(400, "Cash out must be from $0.01 to $10,000.00", "invalid_cashout");
      }
      const result = await creditPlayer({
        playerId: body.playerId,
        regular: -amount,
        entryType: "withdrawal",
        reference: String(body.reason || "Admin cash out record").slice(0, 120),
        createdBy: admin.id,
        idempotencyKey: `cashout:${randomUUID()}`,
        cashCents: -amount,
      });
      if (!result.applied) throw new HttpError(409, "The available cash balance is too low", "insufficient_cash_balance");
      return json(res, 200, result);
    }

    if (body.action === "reset_balance") {
      const result = await resetPlayerBalance({ playerId: body.playerId, createdBy: admin.id });
      return json(res, 200, result);
    }

    if (body.action === "reset_pin") {
      if (!validatePin(body.pin)) throw new HttpError(400, "PIN must contain 4–8 digits", "invalid_pin");
      const credentials = await hashPin(body.pin);
      const rows = await sql`
        UPDATE players
        SET pin_salt = ${credentials.salt}, pin_hash = ${credentials.hash}, updated_at = NOW()
        WHERE id = ${body.playerId} AND role = 'player' AND deleted_at IS NULL
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
        WHERE id = ${body.playerId} AND role = 'player' AND deleted_at IS NULL
        RETURNING id
      `;
      if (!rows.length) throw new HttpError(404, "Player not found", "player_not_found");
      if (body.status === "suspended") await sql`DELETE FROM sessions WHERE player_id = ${body.playerId}`;
      return json(res, 200, { ok: true });
    }

    if (body.action === "delete") {
      const rows = await sql`
        UPDATE players
        SET status = 'suspended', deleted_at = NOW(), updated_at = NOW()
        WHERE id = ${body.playerId} AND role = 'player' AND deleted_at IS NULL
        RETURNING id
      `;
      if (!rows.length) throw new HttpError(404, "Player not found", "player_not_found");
      await sql`DELETE FROM sessions WHERE player_id = ${body.playerId}`;
      return json(res, 200, { ok: true });
    }

    if (body.action === "hard_reset_all") {
      if (body.confirmation !== "DELETE ALL TRANSACTIONS") {
        throw new HttpError(400, "Type the exact confirmation phrase", "confirmation_required");
      }
      const allPlayers = await sql`
        SELECT id, login_id, deleted_at
        FROM players
        WHERE role = 'player'
        ORDER BY login_id ASC
      `;

      const [paymentEvents, messages, rounds, ledger, resetPlayers] = await sql.transaction([
        sql`DELETE FROM payment_events RETURNING id`,
        sql`DELETE FROM support_messages RETURNING id`,
        sql`DELETE FROM game_rounds RETURNING id`,
        sql`DELETE FROM ledger_entries RETURNING id`,
        sql`
          UPDATE players
          SET regular_credits = 0, bonus_credits = 0, updated_at = NOW()
          WHERE role = 'player'
          RETURNING id
        `,
      ]);
      return json(res, 200, {
        ok: true,
        preservedAccounts: allPlayers.map((player) => ({
          loginId: player.login_id,
          archived: Boolean(player.deleted_at),
        })),
        deleted: {
          paymentEvents: paymentEvents.length,
          messages: messages.length,
          gameRounds: rounds.length,
          ledgerEntries: ledger.length,
        },
        resetAccounts: resetPlayers.length,
      });
    }

    throw new HttpError(400, "Unknown admin action", "unknown_action");
  } catch (error) {
    return handleApiError(res, error);
  }
}
