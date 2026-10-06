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
