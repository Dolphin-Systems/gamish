import assert from "node:assert/strict";
import test from "node:test";
import { drawRound, MAX_RTP, publicMath, validateMath } from "../lib/game-models.js";
import { GAME_MATH } from "../lib/games.generated.js";

const weighted = (outcomes, bets = [10]) => ({ model: "weighted", bets, outcomes });

test("every shipped game passes the central math rules", () => {
  for (const [id, math] of Object.entries(GAME_MATH)) {
    const figures = validateMath(id, math);
    assert.ok(figures.rtp <= MAX_RTP, `${id} RTP`);
  }
});

test("Phoenix Ruby keeps its 18 / 8 / 4 table and 80% return", () => {
  const math = GAME_MATH["phoenix-ruby"];
  assert.deepEqual(math.outcomes.map((o) => [o.weight, o.multiplier]), [[18, 0], [8, 1.5], [4, 3]]);
  assert.equal(validateMath("phoenix-ruby", math).rtp, 0.8);
});

test("weighted draws walk the weights in order", () => {
  const math = weighted([{ id: "lose", weight: 3, multiplier: 0 }, { id: "win", weight: 1, multiplier: 2 }]);
  assert.deepEqual([0, 1, 2, 3].map((roll) => drawRound(math, {}, () => roll).outcome), ["lose", "lose", "lose", "win"]);
  assert.equal(validateMath("demo", math).rtp, 0.5);
});

test("models that pay too much, or are malformed, are refused", () => {
  assert.throws(() => validateMath("generous", weighted([{ id: "a", weight: 1, multiplier: 0 }, { id: "b", weight: 1, multiplier: 2 }])), /above the 97% cap/);
  assert.throws(() => validateMath("stingy", weighted([{ id: "a", weight: 9, multiplier: 0 }, { id: "b", weight: 1, multiplier: 1 }])), /below the 50% floor/);
  assert.throws(() => validateMath("dupe", weighted([{ id: "a", weight: 1, multiplier: 0 }, { id: "a", weight: 1, multiplier: 1.5 }])), /twice/);
  assert.throws(() => validateMath("frac", weighted([{ id: "a", weight: 1.5, multiplier: 0 }, { id: "b", weight: 1, multiplier: 1 }])), /whole weight/);
  assert.throws(() => validateMath("bets", weighted([{ id: "a", weight: 1, multiplier: 0 }, { id: "b", weight: 1, multiplier: 1.8 }], [0])), /bet 0/);
  assert.throws(() => validateMath("Bad Id", weighted([])), /lowercase/);
  assert.throws(() => validateMath("odd", { model: "dice", bets: [10] }), /unknown model/);
});

test("target model: P(win) = rtp / target, and losses report a point below the target", () => {
  const math = { model: "target", bets: [10], targets: [2, 4], rtp: 0.96 };
  assert.equal(validateMath("crash", math).rtp, 0.96);
  // Sweep u evenly over (0, 1] and count wins for each target.
  const steps = 200_000;
  for (const target of math.targets) {
    let wins = 0;
    for (let i = 0; i < steps; i += 1) {
      const round = drawRound(math, { target }, () => Math.floor((i / steps) * 1_000_000_000));
      if (round.outcome === "win") {
        wins += 1;
        assert.equal(round.multiplier, target);
        assert.ok(round.value >= target);
      } else {
        assert.equal(round.multiplier, 0);
        assert.ok(round.value < target);
      }
    }
    assert.ok(Math.abs(wins / steps - 0.96 / target) < 0.001, `target ${target}: ${wins / steps}`);
  }
  assert.throws(() => drawRound(math, { target: 3 }), /targets/);
});

test("games learn the payouts, never the weights", () => {
  const math = GAME_MATH["lucky-wheel"];
  const view = publicMath(math, validateMath("lucky-wheel", math));
  assert.ok(view.outcomes.every((outcome) => !("weight" in outcome)));
  assert.deepEqual(view.bets, math.bets);
});

import { baseRtp, effectiveMath, maxTunableRtp, THROTTLE_FLOOR, throttleFactor } from "../lib/game-models.js";

const wheel = () => GAME_MATH["lucky-wheel"];
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("the admin's target RTP is exactly what the adjusted table pays", () => {
  for (const target of [0.5, 0.7, 0.85, 0.95, 0.97]) {
    const { math, applied } = effectiveMath(wheel(), { targetRtp: target, bet: 10 });
    assert.ok(close(baseRtp(math), target), `${target} → ${baseRtp(math)}`);
    assert.ok(close(applied.effectiveRtp, target));
    assert.ok(math.outcomes.every((o) => Number.isInteger(o.weight) && o.weight >= 0));
  }
  // Out of range targets are clamped to what the table and the platform allow.
  assert.ok(close(effectiveMath(wheel(), { targetRtp: 0.2, bet: 10 }).applied.effectiveRtp, 0.5));
  assert.ok(effectiveMath(wheel(), { targetRtp: 2, bet: 10 }).applied.effectiveRtp <= maxTunableRtp(wheel()) + 1e-9);
});

test("the daily limit turns the RTP down, then stops wins above the stake", () => {
  assert.equal(throttleFactor(0), 1);
  assert.equal(throttleFactor(0.5), 1);
  assert.ok(throttleFactor(0.75) < 1 && throttleFactor(0.75) > THROTTLE_FLOOR);
  assert.equal(throttleFactor(1), THROTTLE_FLOOR);
  assert.equal(throttleFactor(3), THROTTLE_FLOOR);
  const half = effectiveMath(wheel(), { targetRtp: 0.9, usage: 0.75, bet: 10 });
  assert.ok(close(half.applied.effectiveRtp, 0.9 * throttleFactor(0.75)));
  const full = effectiveMath(wheel(), { targetRtp: 0.9, usage: 1, bet: 10 });
  assert.ok(full.math.outcomes.every((o) => o.weight === 0 || o.multiplier <= 1));
});

test("no outcome can pay more than the win cap (or the house bank)", () => {
  // $40 cap on a $10 bet: 5× and 10× are gone, the target is still met by the rest.
  const { math, applied } = effectiveMath(wheel(), { targetRtp: 0.9, maxWin: 4_000, bet: 1_000 });
  assert.ok(math.outcomes.every((o) => o.weight === 0 || o.multiplier * 1_000 <= 4_000));
  assert.ok(close(applied.effectiveRtp, 0.9));
  // A bank that can't cover even the smallest win: only 0× remains.
  const broke = effectiveMath(wheel(), { maxWin: 1, bet: 10 });
  assert.ok(broke.math.outcomes.every((o) => o.weight === 0 || o.multiplier === 0));
  const crash = { model: "target", bets: [10], targets: [2, 5, 10], rtp: 0.95 };
  assert.deepEqual(effectiveMath(crash, { maxWin: 50, bet: 10 }).math.targets, [2, 5]);
});
