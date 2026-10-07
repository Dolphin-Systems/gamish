import assert from "node:assert/strict";
import test from "node:test";
import { capJackpots, CONTRIBUTION, JACKPOT_TIERS, jackpotChance, PROFIT_CAP_SHARE } from "../lib/jackpot-rules.js";

const rows = (minor, major, mega) => [
  { tier: "minor", amount_milli: minor * 1000 }, { tier: "major", amount_milli: major * 1000 }, { tier: "mega", amount_milli: mega * 1000 },
];

test("pots never show more than a fifth of the house's profit, in total", () => {
  for (const profit of [0, -5000, 1, 999, 10_000, 1_234_567]) {
    const view = capJackpots(rows(1e9, 1e9, 1e9), profit);
    const total = view.reduce((sum, item) => sum + item.cents, 0);
    assert.ok(total <= Math.max(0, profit) * PROFIT_CAP_SHARE, `profit ${profit}: total ${total}`);
  }
  assert.deepEqual(capJackpots(rows(500, 500, 500), 0).map((item) => item.cents), [0, 0, 0], "no profit, no jackpots");
});

test("below the cap, pots show what they have grown to", () => {
  const view = capJackpots(rows(150, 600, 3000), 1_000_000); // cap $2,000 total
  assert.deepEqual(view.map((item) => item.cents), [150, 600, 3000]);
  assert.deepEqual(view.map((item) => item.label), ["MINOR", "MAJOR", "MEGA"]);
});

test("odds scale with the bet and MEGA is the rarest", () => {
  const [minor, major, mega] = JACKPOT_TIERS;
  assert.ok(jackpotChance(minor, 10) > jackpotChance(major, 10) && jackpotChance(major, 10) > jackpotChance(mega, 10));
  assert.equal(jackpotChance(minor, 100), jackpotChance(minor, 10) * 10);
  assert.ok(jackpotChance(minor, 1e9) <= 0.5);
  assert.equal(JACKPOT_TIERS.reduce((sum, tier) => sum + tier.share, 0), 1);
  assert.equal(CONTRIBUTION, 0.01);
});
