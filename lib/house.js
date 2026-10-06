import { ensureSchema, getSql, HOUSE_START_CENTS } from "./db.js";
import { HttpError } from "./http.js";
import { randomUUID } from "./security.js";

// The house bank (see lib/db.js). Game rounds move money in and out of it inside
// recordGameRound; this file holds everything else: reading it, the admin's starting amount,
// adding capital, taking profit, and bonuses, which may only come out of profit.

export const START_OPTIONS_CENTS = [50_000, 100_000, 150_000, 200_000];
const MAX_MOVE_CENTS = 100_000_000;

const money = (cents) => `$${(Number(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const checkAmount = (cents) => {
  if (!Number.isInteger(cents) || cents < 100 || cents > MAX_MOVE_CENTS) throw new HttpError(400, "Amount must be from $1 to $1,000,000", "invalid_amount");
};

export async function getHouse() {
  await ensureSchema();
  const sql = getSql();
  const [house] = await sql`SELECT * FROM house WHERE id = 1`;
  const [activity] = await sql`
    SELECT
      (SELECT COUNT(*) FROM game_rounds WHERE created_at >= ${house.created_at})::INTEGER AS rounds,
      (SELECT COUNT(*) FROM house_ledger WHERE kind <> 'start')::INTEGER AS moves,
      (SELECT COALESCE(SUM(-amount_cents), 0) FROM house_ledger WHERE kind = 'bonus') AS bonuses,
      (SELECT COALESCE(SUM(-amount_cents), 0) FROM house_ledger WHERE kind = 'withdraw') AS withdrawn
  `;
  const capitalCents = Number(house.capital_cents);
  const balanceCents = Number(house.balance_cents);
  return {
    capitalCents,
    balanceCents,
    profitCents: balanceCents - capitalCents,
    bonusesPaidCents: Number(activity.bonuses),
    withdrawnCents: Number(activity.withdrawn),
    // The starting amount can be picked until the bank has been used.
    fresh: Number(activity.rounds) === 0 && Number(activity.moves) === 0,
    startOptionsCents: START_OPTIONS_CENTS,
    defaultStartCents: HOUSE_START_CENTS,
    createdAt: house.created_at,
  };
}

export async function houseLedger(limit = 20) {
  await ensureSchema();
  const rows = await getSql()`
    SELECT h.*, p.login_id FROM house_ledger h LEFT JOIN players p ON p.id = h.created_by
    ORDER BY h.created_at DESC LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id, kind: row.kind, amountCents: Number(row.amount_cents), balanceAfterCents: Number(row.balance_after_cents),
    reference: row.reference || "", by: row.login_id || null, createdAt: row.created_at,
  }));
}

export async function setStartingBank(cents, adminId) {
  checkAmount(cents);
  const house = await getHouse();
  if (!house.fresh) throw new HttpError(409, "Games have already used the bank. Add capital instead.", "house_in_use");
  const sql = getSql();
  await sql`UPDATE house SET capital_cents = ${cents}, balance_cents = ${cents}, created_at = NOW(), updated_at = NOW() WHERE id = 1`;
  await sql`
    INSERT INTO house_ledger (id, kind, amount_cents, balance_after_cents, reference, created_by)
    VALUES (${randomUUID()}, 'start', ${cents}, ${cents}, ${`Starting bank ${money(cents)}`}, ${adminId})
  `;
  return getHouse();
}

export async function addCapital(cents, adminId) {
  checkAmount(cents);
  await ensureSchema();
  const [row] = await getSql()`
    WITH changed AS (
      UPDATE house SET capital_cents = capital_cents + ${cents}, balance_cents = balance_cents + ${cents}, updated_at = NOW()
      WHERE id = 1 RETURNING balance_cents
    )
    INSERT INTO house_ledger (id, kind, amount_cents, balance_after_cents, reference, created_by)
    SELECT ${randomUUID()}, 'capital', ${cents}, balance_cents, ${`Added ${money(cents)}`}, ${adminId} FROM changed
    RETURNING balance_after_cents
  `;
  if (!row) throw new HttpError(500, "Could not add to the bank", "house_failed");
  return getHouse();
}

// Taking profit never touches capital, so the bank always keeps what the admin put in.
export async function takeProfit(cents, adminId) {
  checkAmount(cents);
  await ensureSchema();
  const [row] = await getSql()`
    WITH changed AS (
      UPDATE house SET balance_cents = balance_cents - ${cents}, updated_at = NOW()
      WHERE id = 1 AND balance_cents - ${cents} >= capital_cents
      RETURNING balance_cents
    )
    INSERT INTO house_ledger (id, kind, amount_cents, balance_after_cents, reference, created_by)
    SELECT ${randomUUID()}, 'withdraw', ${-cents}, balance_cents, ${`Took ${money(cents)} of profit`}, ${adminId} FROM changed
    RETURNING balance_after_cents
  `;
  if (!row) throw new HttpError(409, "That is more than the bank's profit", "not_enough_profit");
  return getHouse();
}

// What bonuses can spend right now: profit only.
export async function bonusBudget() {
  const house = await getHouse();
  return { available: Math.max(0, house.profitCents), profitCents: house.profitCents, capitalCents: house.capitalCents };
}

// Gives a player bonus credits paid from the house's profit, in one statement: the player
// row is locked first (the same order as game rounds), then the bank is checked under lock.
export async function grantBonus({ playerId, amount, reference, createdBy, idempotencyKey }) {
  if (!Number.isInteger(amount) || amount < 1) throw new HttpError(400, "Invalid bonus", "invalid_amount");
  await ensureSchema();
  const sql = getSql();
  const ledgerId = randomUUID();
  const [row] = await sql`
    WITH eligible AS (
      SELECT id FROM players WHERE id = ${playerId} AND deleted_at IS NULL FOR UPDATE
    ), house_ok AS (
      SELECT id FROM house
      WHERE id = 1 AND balance_cents - ${amount} >= capital_cents AND EXISTS (SELECT 1 FROM eligible)
      FOR UPDATE
    ), new_entry AS (
      INSERT INTO ledger_entries (id, player_id, entry_type, regular_delta, bonus_delta, cash_cents, reference, idempotency_key, created_by)
      SELECT ${ledgerId}, ${playerId}, 'bonus_credit', 0, ${amount}, 0, ${reference || null}, ${idempotencyKey || null}, ${createdBy || null}
      FROM house_ok
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ), player_changed AS (
      UPDATE players SET bonus_credits = bonus_credits + ${amount}, updated_at = NOW()
      WHERE id = ${playerId} AND EXISTS (SELECT 1 FROM new_entry)
      RETURNING regular_credits, bonus_credits
    ), house_changed AS (
      UPDATE house SET balance_cents = balance_cents - ${amount}, updated_at = NOW()
      WHERE id = 1 AND EXISTS (SELECT 1 FROM new_entry)
      RETURNING balance_cents
    ), house_entry AS (
      INSERT INTO house_ledger (id, kind, amount_cents, balance_after_cents, reference, created_by)
      SELECT ${randomUUID()}, 'bonus', ${-amount}, balance_cents, ${reference || "Bonus"}, ${createdBy || null} FROM house_changed
      RETURNING id
    )
    SELECT
      pc.regular_credits, pc.bonus_credits,
      (SELECT COUNT(*) FROM house_ok)::INTEGER AS affordable,
      (SELECT COUNT(*) FROM house_entry)::INTEGER AS logged
    FROM (SELECT 1) AS one LEFT JOIN player_changed pc ON TRUE
  `;
  if (!Number(row.affordable)) {
    const budget = await bonusBudget();
    throw new HttpError(409, `Bonuses come from profit: only ${money(budget.available)} is available`, "bonus_exceeds_profit");
  }
  if (row.regular_credits === null) return { applied: false };
  const regularCredits = Number(row.regular_credits);
  const bonusCredits = Number(row.bonus_credits);
  return { applied: true, ledgerId, wallet: { regularCredits, bonusCredits, totalCredits: regularCredits + bonusCredits } };
}
