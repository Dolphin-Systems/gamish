import { ensureSchema, getSql } from "./db.js";
import { HttpError } from "./http.js";
import { randomUUID } from "./security.js";

export async function getWallet(playerId) {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT regular_credits, bonus_credits
    FROM players
    WHERE id = ${playerId}
  `;
  if (!row) throw new HttpError(404, "Player not found", "player_not_found");
  const regularCredits = Number(row.regular_credits);
  const bonusCredits = Number(row.bonus_credits);
  return { regularCredits, bonusCredits, totalCredits: regularCredits + bonusCredits };
}

export async function getWeeklyBonusPool() {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'game_bet' THEN -(regular_delta + bonus_delta) ELSE 0 END), 0) AS wagered,
      COALESCE(SUM(CASE WHEN entry_type = 'game_win' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN entry_type = 'bonus_credit' THEN bonus_delta ELSE 0 END), 0) AS bonuses
    FROM ledger_entries
    WHERE created_at >= date_trunc('week', NOW())
  `;
  const wagered = Number(row.wagered);
  const won = Number(row.won);
  const bonuses = Number(row.bonuses);
  return { wagered, won, bonuses, available: Math.max(0, wagered - won - bonuses) };
}

export async function creditPlayer({ playerId, regular = 0, bonus = 0, entryType, reference, createdBy, idempotencyKey, cashCents = 0 }) {
  await ensureSchema();
  const sql = getSql();
  const ledgerId = randomUUID();
  const rows = await sql`
    WITH eligible AS (
      SELECT id
      FROM players
      WHERE id = ${playerId}
        AND deleted_at IS NULL
        AND regular_credits + ${regular} >= 0
        AND bonus_credits + ${bonus} >= 0
      FOR UPDATE
    ), new_entry AS (
      INSERT INTO ledger_entries (
        id, player_id, entry_type, regular_delta, bonus_delta, cash_cents,
        reference, idempotency_key, created_by
      )
      SELECT
        ${ledgerId}, ${playerId}, ${entryType}, ${regular}, ${bonus}, ${cashCents},
        ${reference || null}, ${idempotencyKey || null}, ${createdBy || null}
      FROM eligible
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ), changed AS (
      UPDATE players
      SET regular_credits = regular_credits + ${regular},
          bonus_credits = bonus_credits + ${bonus},
          updated_at = NOW()
      WHERE id = ${playerId}
        AND EXISTS (SELECT 1 FROM new_entry)
      RETURNING regular_credits, bonus_credits
    )
    SELECT regular_credits, bonus_credits, TRUE AS applied FROM changed
  `;
  if (!rows.length) return { applied: false, wallet: await getWallet(playerId) };
  const row = rows[0];
  const regularCredits = Number(row.regular_credits);
  const bonusCredits = Number(row.bonus_credits);
  return { applied: true, ledgerId, wallet: { regularCredits, bonusCredits, totalCredits: regularCredits + bonusCredits } };
}

export async function resetPlayerBalance({ playerId, createdBy }) {
  await ensureSchema();
  const sql = getSql();
  const ledgerId = randomUUID();
  const [row] = await sql`
    WITH eligible AS (
      SELECT id, regular_credits, bonus_credits
      FROM players
      WHERE id = ${playerId} AND role = 'player' AND deleted_at IS NULL
      FOR UPDATE
    ), changed AS (
      UPDATE players p
      SET regular_credits = 0, bonus_credits = 0, updated_at = NOW()
      FROM eligible e
      WHERE p.id = e.id
      RETURNING e.regular_credits AS previous_regular, e.bonus_credits AS previous_bonus
    ), saved AS (
      INSERT INTO ledger_entries (
        id, player_id, entry_type, regular_delta, bonus_delta,
        reference, idempotency_key, created_by
      )
      SELECT ${ledgerId}, ${playerId}, 'adjustment', -previous_regular, -previous_bonus,
        'Admin test balance reset', ${`reset:${ledgerId}`}, ${createdBy}
      FROM changed
      RETURNING id
    )
    SELECT previous_regular, previous_bonus FROM changed
  `;
  if (!row) throw new HttpError(404, "Player not found", "player_not_found");
  return {
    previous: {
      regularCredits: Number(row.previous_regular),
      bonusCredits: Number(row.previous_bonus),
      totalCredits: Number(row.previous_regular) + Number(row.previous_bonus),
    },
    wallet: { regularCredits: 0, bonusCredits: 0, totalCredits: 0 },
  };
}

export async function recordGameRound({ playerId, bet, multiplier, marks }) {
  await ensureSchema();
  const sql = getSql();
  const payout = Math.round(bet * multiplier);
  const roundId = randomUUID();
  const betEntryId = randomUUID();
  const winEntryId = randomUUID();
  const [row] = await sql`
    WITH eligible AS (
      SELECT
        id,
        LEAST(bonus_credits, ${bet})::INTEGER AS bonus_spent,
        (${bet} - LEAST(bonus_credits, ${bet}))::INTEGER AS regular_spent
      FROM players
      WHERE id = ${playerId}
        AND status = 'active'
        AND deleted_at IS NULL
        AND regular_credits + bonus_credits >= ${bet}
      FOR UPDATE
    ), calculated AS (
      SELECT
        *,
        FLOOR(${payout}::NUMERIC * bonus_spent / ${bet})::INTEGER AS bonus_payout
      FROM eligible
    ), changed AS (
      UPDATE players p
      SET regular_credits = p.regular_credits - c.regular_spent + (${payout} - c.bonus_payout),
          bonus_credits = p.bonus_credits - c.bonus_spent + c.bonus_payout,
          updated_at = NOW()
      FROM calculated c
      WHERE p.id = c.id
      RETURNING p.regular_credits, p.bonus_credits, c.regular_spent, c.bonus_spent, c.bonus_payout
    ), saved_round AS (
      INSERT INTO game_rounds (id, player_id, bet, multiplier, payout, regular_spent, bonus_spent)
      SELECT ${roundId}, ${playerId}, ${bet}, ${multiplier}, ${payout}, regular_spent, bonus_spent
      FROM changed
      RETURNING id
    ), bet_entry AS (
      INSERT INTO ledger_entries (id, player_id, entry_type, regular_delta, bonus_delta, reference, idempotency_key)
      SELECT ${betEntryId}, ${playerId}, 'game_bet', -regular_spent, -bonus_spent, ${`round:${roundId}`}, ${`round:${roundId}:bet`}
      FROM changed
      RETURNING id
    ), win_entry AS (
      INSERT INTO ledger_entries (id, player_id, entry_type, regular_delta, bonus_delta, reference, idempotency_key)
      SELECT ${winEntryId}, ${playerId}, 'game_win', ${payout} - bonus_payout, bonus_payout, ${`round:${roundId}`}, ${`round:${roundId}:win`}
      FROM changed
      WHERE ${payout} > 0
      RETURNING id
    )
    SELECT regular_credits, bonus_credits, regular_spent, bonus_spent
    FROM changed
  `;

  if (!row) throw new HttpError(409, "Not enough credits", "insufficient_credits");
  const regularCredits = Number(row.regular_credits);
  const bonusCredits = Number(row.bonus_credits);
  return {
    roundId,
    bet,
    multiplier,
    payout,
    marks,
    spent: { regular: Number(row.regular_spent), bonus: Number(row.bonus_spent) },
    wallet: { regularCredits, bonusCredits, totalCredits: regularCredits + bonusCredits },
  };
}
