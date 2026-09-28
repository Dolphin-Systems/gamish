import { ensureSchema, getSql } from "./db.js";
import { HttpError } from "./http.js";
import { creditPlayer, getWeeklyBonusPool } from "./ledger.js";
import { depositBonusCents, MAX_DEPOSIT_CENTS, MAX_PENDING_PER_KIND, cleanText, validateRequestInput } from "./payment-rules.js";
import { randomUUID } from "./security.js";

export { depositBonusCents };

export const serializeRequest = (row) => ({
  id: row.id,
  playerId: row.player_id,
  loginId: row.login_id,
  kind: row.kind,
  amountCents: Number(row.amount_cents),
  bonusCents: Number(row.bonus_cents),
  creditedCents: row.credited_cents === null || row.credited_cents === undefined ? null : Number(row.credited_cents),
  methodName: row.method_name,
  paymentHandle: row.payment_handle,
  note: row.player_note || "",
  status: row.status,
  adminNote: row.admin_note || "",
  createdAt: row.created_at,
  decidedAt: row.decided_at,
  ...(row.regular_credits !== undefined ? {
    playerBalance: { regularCredits: Number(row.regular_credits), bonusCredits: Number(row.bonus_credits) },
  } : {}),
});

export async function listPlayerRequests(playerId) {
  await ensureSchema();
  const rows = await getSql()`
    SELECT * FROM payment_requests
    WHERE player_id = ${playerId}
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return rows.map(serializeRequest);
}

export async function listAdminRequests({ status } = {}) {
  await ensureSchema();
  const sql = getSql();
  const rows = status === "pending"
    ? await sql`
        SELECT r.*, p.login_id, p.regular_credits, p.bonus_credits
        FROM payment_requests r JOIN players p ON p.id = r.player_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC
        LIMIT 200
      `
    : await sql`
        SELECT r.*, p.login_id, p.regular_credits, p.bonus_credits
        FROM payment_requests r JOIN players p ON p.id = r.player_id
        ORDER BY r.created_at DESC
        LIMIT 100
      `;
  return rows.map(serializeRequest);
}

export async function createPaymentRequest(player, input) {
  await ensureSchema();
  const sql = getSql();
  const request = validateRequestInput(input);

  const [pending] = await sql`
    SELECT COUNT(*)::INTEGER AS count, COALESCE(SUM(amount_cents), 0)::INTEGER AS cents
    FROM payment_requests
    WHERE player_id = ${player.id} AND kind = ${request.kind} AND status = 'pending'
  `;
  if (pending.count >= MAX_PENDING_PER_KIND) {
    throw new HttpError(429, "You already have requests waiting. Please wait for the team to review them", "too_many_pending_requests");
  }

  let paymentHandle = request.paymentHandle;
  let bonusCents = 0;
  if (request.kind === "deposit") {
    // Record the ID the player was actually shown, so the admin knows where to look for the money.
    const [method] = await sql`
      SELECT method_name, payment_id FROM payment_methods
      WHERE LOWER(method_name) = LOWER(${request.methodName}) AND enabled AND is_current
      LIMIT 1
    `;
    if (!method) throw new HttpError(409, "That payment method is no longer available. Please choose another", "payment_method_unavailable");
    paymentHandle = method.payment_id;
    request.methodName = method.method_name;
    bonusCents = depositBonusCents(request.amountCents);
  } else {
    const [wallet] = await sql`SELECT regular_credits FROM players WHERE id = ${player.id}`;
    const cashable = Number(wallet?.regular_credits || 0) - Number(pending.cents);
    if (request.amountCents > cashable) {
      throw new HttpError(409, `You can cash out up to $${(Math.max(0, cashable) / 100).toFixed(2)} right now`, "insufficient_cashable_balance");
    }
  }

  const [row] = await sql`
    INSERT INTO payment_requests (id, player_id, kind, amount_cents, bonus_cents, method_name, payment_handle, player_note)
    VALUES (${randomUUID()}, ${player.id}, ${request.kind}, ${request.amountCents}, ${bonusCents},
      ${request.methodName}, ${paymentHandle}, ${request.note || null})
    RETURNING *
  `;
  return serializeRequest(row);
}

export async function cancelPaymentRequest(player, id) {
  await ensureSchema();
  const rows = await getSql()`
    UPDATE payment_requests
    SET status = 'cancelled', decided_at = NOW()
    WHERE id = ${id} AND player_id = ${player.id} AND status = 'pending'
    RETURNING *
  `;
  if (!rows.length) throw new HttpError(409, "This request can no longer be cancelled", "request_not_pending");
  return serializeRequest(rows[0]);
}

export async function declinePaymentRequest(admin, id, note) {
  await ensureSchema();
  const rows = await getSql()`
    UPDATE payment_requests
    SET status = 'declined', admin_note = ${cleanText(note, 140) || null}, decided_at = NOW(), decided_by = ${admin.id}
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;
  if (!rows.length) throw new HttpError(409, "This request was already handled", "request_not_pending");
  return serializeRequest(rows[0]);
}

export async function approvePaymentRequest(admin, id, { amountCents: overrideCents, note } = {}) {
  await ensureSchema();
  const sql = getSql();
  const adminNote = cleanText(note, 140) || null;

  // Claim the request first so two admins can never both apply it.
  const [claimed] = await sql`
    UPDATE payment_requests
    SET status = 'approved', admin_note = ${adminNote}, decided_at = NOW(), decided_by = ${admin.id}
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;
  if (!claimed) throw new HttpError(409, "This request was already handled", "request_not_pending");

  const release = () => sql`
    UPDATE payment_requests SET status = 'pending', admin_note = NULL, decided_at = NULL, decided_by = NULL
    WHERE id = ${id} AND status = 'approved' AND ledger_entry_id IS NULL
  `;

  try {
    let amount = Number(claimed.amount_cents);
    if (claimed.kind === "deposit" && overrideCents !== undefined && overrideCents !== null && overrideCents !== "") {
      amount = Number(overrideCents);
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_DEPOSIT_CENTS) {
        throw new HttpError(400, "Received amount must be from $0.01 to $1,000", "invalid_received_amount");
      }
    }

    const deposit = claimed.kind === "deposit";
    const result = await creditPlayer({
      playerId: claimed.player_id,
      regular: deposit ? amount : -amount,
      entryType: deposit ? "payment_credit" : "withdrawal",
      reference: deposit ? `Deposit via ${claimed.method_name}` : `Cash out to ${claimed.method_name} ${claimed.payment_handle}`,
      createdBy: admin.id,
      idempotencyKey: `request:${id}`,
      cashCents: deposit ? amount : -amount,
    });
    if (!result.applied) {
      throw deposit
        ? new HttpError(409, "The player account is unavailable", "player_unavailable")
        : new HttpError(409, "The player's cashable balance is too low for this cash out", "insufficient_cash_balance");
    }
    // From here the money has moved: record it before anything else can fail.
    let [row] = await sql`
      UPDATE payment_requests
      SET ledger_entry_id = ${result.ledgerId}, credited_cents = ${amount}, bonus_cents = 0
      WHERE id = ${id}
      RETURNING *
    `;
    let wallet = result.wallet;

    if (deposit) {
      // The advertised bonus follows the amount actually received and the weekly bonus pool.
      try {
        const bonus = Math.min(depositBonusCents(amount), (await getWeeklyBonusPool()).available);
        if (bonus > 0) {
          const bonusResult = await creditPlayer({
            playerId: claimed.player_id,
            bonus,
            entryType: "bonus_credit",
            reference: `Deposit bonus via ${claimed.method_name}`,
            createdBy: admin.id,
            idempotencyKey: `request:${id}:bonus`,
          });
          if (bonusResult.applied) {
            wallet = bonusResult.wallet;
            [row] = await sql`UPDATE payment_requests SET bonus_cents = ${bonus} WHERE id = ${id} RETURNING *`;
          }
        }
      } catch {
        // A bonus problem must not undo a deposit that has already been credited.
      }
    }
    return { request: serializeRequest(row), wallet };
  } catch (error) {
    await release().catch(() => {});
    throw error;
  }
}
