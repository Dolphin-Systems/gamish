// The jackpot rules (pure, no database): tiers, shares, the profit cap and the odds.
export const JACKPOT_TIERS = [
  { tier: "minor", label: "MINOR", seedCents: 100, share: 0.5, capShare: 0.2, oddsPer10: 1 / 1_500 },
  { tier: "major", label: "MAJOR", seedCents: 500, share: 0.3, capShare: 0.3, oddsPer10: 1 / 15_000 },
  { tier: "mega", label: "MEGA", seedCents: 2_500, share: 0.2, capShare: 0.5, oddsPer10: 1 / 150_000 },
];
export const CONTRIBUTION = 0.01;
export const PROFIT_CAP_SHARE = 0.2;
export const MILLI = 1_000;

// What each pot shows (and would pay) right now, given the house's profit.
export function capJackpots(rows, profitCents) {
  const capTotal = Math.max(0, Math.floor(profitCents * PROFIT_CAP_SHARE));
  return JACKPOT_TIERS.map(({ tier, label, capShare }) => {
    const row = rows.find((item) => item.tier === tier);
    const pot = Math.floor(Number(row?.amount_milli ?? 0) / MILLI);
    const cap = Math.floor(capTotal * capShare);
    return { tier, label, cents: Math.min(pot, cap), capCents: cap, potCents: pot };
  });
}

// The chance a bet wins a tier this round.
export const jackpotChance = (tier, bet) => Math.min(0.5, tier.oddsPer10 * (bet / 10));

