import { getSessionPlayer, publicPlayer } from "../../lib/auth.js";
import { ensureSchema, getSql, HOUSE_START_CENTS } from "../../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { bonusBudget, grantBonus } from "../../lib/house.js";
import { creditPlayer, resetPlayerBalance } from "../../lib/ledger.js";
import { serializeRequest } from "../../lib/payment-requests.js";
import { hashPin, normalizeLoginId, randomUUID, validateLoginId, validatePin } from "../../lib/security.js";

const MAX_CREDIT = 1_000_000;

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const admin = await getSessionPlayer(req, { role: "admin" });
    await ensureSchema();
    const sql = getSql();

    // One player's recent history for the admin detail drawer.
    const detailId = req.method === "GET" ? new URL(req.url, "http://localhost").searchParams.get("playerId") : null;
    if (detailId) {
      const [player] = await sql`SELECT * FROM players WHERE id = ${detailId} AND role = 'player'`;
      if (!player) throw new HttpError(404, "Player not found", "player_not_found");
      const [stats] = await sql`
        SELECT
          COUNT(*) AS rounds,
          COUNT(*) FILTER (WHERE payout > 0) AS winning_rounds,
          COALESCE(SUM(bet), 0) AS wagered,
          COALESCE(SUM(payout), 0) AS won,
          MAX(created_at) AS last_played_at
        FROM game_rounds WHERE player_id = ${detailId}
      `;
      const ledger = await sql`
        SELECT entry_type, regular_delta, bonus_delta, cash_cents, reference, created_at
        FROM ledger_entries
        WHERE player_id = ${detailId} AND entry_type NOT IN ('game_bet', 'game_win')
        ORDER BY created_at DESC LIMIT 25
      `;
      const requests = await sql`
        SELECT * FROM payment_requests WHERE player_id = ${detailId} ORDER BY created_at DESC LIMIT 10
      `;
      return json(res, 200, {
        player: { ...publicPlayer(player), createdAt: player.created_at, lastLoginAt: player.last_login_at },
        stats: {
          rounds: Number(stats.rounds),
          winningRounds: Number(stats.winning_rounds),
          wagered: Number(stats.wagered),
          won: Number(stats.won),
          lastPlayedAt: stats.last_played_at,
        },
        ledger: ledger.map((row) => ({
          type: row.entry_type,
          amountCents: row.entry_type === "withdrawal" ? -Math.abs(Number(row.cash_cents)) : Number(row.regular_delta) + Number(row.bonus_delta),
          note: row.reference || "",
          createdAt: row.created_at,
        })),
        requests: requests.map(serializeRequest),
      });
    }

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
        bonusPool: await bonusBudget(),
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
      // Bonus cash is paid out of the house bank's profit (grantBonus refuses more than that).
      const result = balanceType === "bonus" ? await grantBonus({
        playerId: body.playerId,
        amount,
        reference: String(body.reason || "Admin bonus").slice(0, 120),
        createdBy: admin.id,
        idempotencyKey: `admin:${randomUUID()}`,
      }) : await creditPlayer({
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
      if (body.confirmation !== "HARD RESET EVERYTHING") {
        throw new HttpError(400, "Type the exact confirmation phrase", "confirmation_required");
      }
      const adminAccounts = await sql`SELECT id, login_id FROM players WHERE role = 'admin' ORDER BY login_id ASC`;

      const [paymentRequests, paymentFlowLogs, paymentEvents, messages, rounds, ledger, paymentMethods, sessions, loginAttempts, gameSettings, houseLedger, houseBank, gameAvailability, playerAccounts] = await sql.transaction([
        sql`DELETE FROM payment_requests RETURNING id`,
        sql`DELETE FROM payment_flow_logs RETURNING id`,
        sql`DELETE FROM payment_events RETURNING id`,
        sql`DELETE FROM support_messages RETURNING id`,
        sql`DELETE FROM game_rounds RETURNING id`,
        sql`DELETE FROM ledger_entries RETURNING id`,
        sql`DELETE FROM payment_methods RETURNING id`,
        sql`DELETE FROM sessions RETURNING id`,
        sql`DELETE FROM login_attempts RETURNING attempt_key`,
        sql`DELETE FROM game_settings RETURNING game_id`,
        sql`DELETE FROM house_ledger RETURNING id`,
        sql`
          UPDATE house
          SET capital_cents = ${HOUSE_START_CENTS}, balance_cents = ${HOUSE_START_CENTS}, created_at = NOW(), updated_at = NOW()
          WHERE id = 1
          RETURNING id
        `,
        sql`UPDATE games SET enabled = TRUE, updated_at = NOW() RETURNING id`,
        sql`DELETE FROM players WHERE role = 'player' RETURNING id`,
      ]);
      return json(res, 200, {
        ok: true,
        preservedAdminAccounts: adminAccounts.map((account) => account.login_id),
        deleted: {
          paymentRequests: paymentRequests.length,
          paymentFlowLogs: paymentFlowLogs.length,
          paymentEvents: paymentEvents.length,
          messages: messages.length,
          gameRounds: rounds.length,
          ledgerEntries: ledger.length,
          paymentMethods: paymentMethods.length,
          sessions: sessions.length,
          loginAttempts: loginAttempts.length,
          gameSettings: gameSettings.length,
          houseLedgerEntries: houseLedger.length,
          playerAccounts: playerAccounts.length,
        },
        reset: {
          houseBankRows: houseBank.length,
          gameAvailabilityRows: gameAvailability.length,
          startingCapitalCents: HOUSE_START_CENTS,
        },
      });
    }

    throw new HttpError(400, "Unknown admin action", "unknown_action");
  } catch (error) {
    return handleApiError(res, error);
  }
}
