import { randomInt } from "node:crypto";
import { ensureSchema, getSql } from "./db.js";
import { capJackpots, CONTRIBUTION as JACKPOT_CONTRIBUTION, JACKPOT_TIERS, jackpotChance, MILLI } from "./jackpot-rules.js";

export { capJackpots, CONTRIBUTION, JACKPOT_TIERS, jackpotChance, PROFIT_CAP_SHARE } from "./jackpot-rules.js";

// Platform jackpots, shared by every game: MINOR, MAJOR and MEGA.
//
// * Growing: 1% of every bet in every game is added to the pots (split 50 / 30 / 20).
// * Capped: together the pots never show or pay more than a fifth of the house bank's profit
//   (balance above capital), split 20% / 30% / 50%. With no profit they show $0 and can't be won.
// * Won at random on any round; bigger bets have proportionally better odds. The win is paid
//   from the house bank in the same statement as the round (lib/ledger.js), so the bank still
//   can't go below zero, and the pot resets to its seed.
//
// Pots are kept in thousandths of a cent so a 1% share of small bets still adds up.
let ready;
export function ensureJackpots() {
  ready ??= (async () => {
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS jackpots (
        tier TEXT PRIMARY KEY,
        amount_milli BIGINT NOT NULL CHECK (amount_milli >= 0),
        won_count INTEGER NOT NULL DEFAULT 0,
        last_won_at TIMESTAMPTZ,
        last_won_cents INTEGER,
        last_won_by UUID REFERENCES players(id) ON DELETE SET NULL
      )
    `;
    for (const { tier, seedCents } of JACKPOT_TIERS) {
      await sql`INSERT INTO jackpots (tier, amount_milli) VALUES (${tier}, ${seedCents * MILLI}) ON CONFLICT (tier) DO NOTHING`;
    }
  })().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function jackpotView() {
  await ensureJackpots();
  const sql = getSql();
  const [rows, [house]] = await Promise.all([
    sql`SELECT tier, amount_milli FROM jackpots`,
    sql`SELECT balance_cents - capital_cents AS profit FROM house WHERE id = 1`,
  ]);
  return capJackpots(rows, Number(house?.profit ?? 0)).map(({ tier, label, cents }) => ({ tier, label, cents }));
}

// Rolls for a jackpot (MEGA first). On a hit, claims the pot atomically and returns what to
// pay; the caller pays it with the round, or hands the claim back to refundJackpot on failure.
export async function rollJackpot(bet, rng = (n) => randomInt(n)) {
  await ensureJackpots();
  const sql = getSql();
  const roll = rng(1_000_000_000) / 1_000_000_000;
  let floor = 0;
  let hit = null;
  for (const tier of [...JACKPOT_TIERS].reverse()) {
    const chance = jackpotChance(tier, bet);
    if (roll >= floor && roll < floor + chance) {
      hit = tier;
      break;
    }
    floor += chance;
  }
  if (!hit) return null;
  // Read the pot with its win counter; the claim only succeeds if nobody claimed it since.
  const [[row], [house]] = await Promise.all([
    sql`SELECT tier, amount_milli, won_count FROM jackpots WHERE tier = ${hit.tier}`,
    sql`SELECT balance_cents - capital_cents AS profit FROM house WHERE id = 1`,
  ]);
  const view = capJackpots([row], Number(house?.profit ?? 0)).find((item) => item.tier === hit.tier);
  if (!view || view.cents < 1) return null;
  const [claim] = await sql`
    WITH old AS (SELECT tier, amount_milli FROM jackpots WHERE tier = ${hit.tier} AND won_count = ${row.won_count} FOR UPDATE)
    UPDATE jackpots j SET amount_milli = ${hit.seedCents * MILLI}, won_count = j.won_count + 1
    FROM old WHERE j.tier = old.tier
    RETURNING old.amount_milli AS previous
  `;
  if (!claim) return null; // someone else just won it
  return { tier: hit.tier, label: hit.label, cents: view.cents, previousMilli: Number(claim.previous), seedMilli: hit.seedCents * MILLI };
}

export async function refundJackpot(claim) {
  if (!claim) return;
  await getSql()`
    UPDATE jackpots SET amount_milli = amount_milli - ${claim.seedMilli} + ${claim.previousMilli}, won_count = won_count - 1
    WHERE tier = ${claim.tier}
  `;
}

export async function recordJackpotWin(claim, playerId) {
  await getSql()`
    UPDATE jackpots SET last_won_at = NOW(), last_won_cents = ${claim.cents}, last_won_by = ${playerId} WHERE tier = ${claim.tier}
  `;
}

// Every settled round feeds the pots.
export async function contributeToJackpots(bet) {
  await ensureJackpots();
  const total = Math.round(bet * JACKPOT_CONTRIBUTION * MILLI);
  const [minor, major, mega] = JACKPOT_TIERS.map(({ share }) => Math.round(total * share));
  await getSql()`
    UPDATE jackpots SET amount_milli = amount_milli + CASE tier
      WHEN 'minor' THEN ${minor}::BIGINT WHEN 'major' THEN ${major}::BIGINT ELSE ${mega}::BIGINT END
  `;
}
