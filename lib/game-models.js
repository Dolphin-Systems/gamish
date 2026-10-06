import { randomInt } from "node:crypto";
import { HttpError } from "./http.js";

// The central math. Every game's odds are data (its math.json), run here on the server with the
// crypto RNG. Games never decide outcomes: they ask for a round and show what comes back.
//
// Models:
//   weighted  A table of outcomes with integer weights and payout multipliers (slots, wheels,
//             scratch cards, mystery boxes…). RTP = Σ weight·multiplier / Σ weight.
//   target    The player picks a target multiplier before the round (crash, limbo, dice). A
//             crash point is drawn so that P(point ≥ target) = rtp / target, for every target.

export const MAX_RTP = 0.97;
export const MIN_RTP = 0.5;
export const MAX_MULTIPLIER = 500; // game_rounds.multiplier is NUMERIC(5, 2)
const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const OUTCOME_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CENTS = (value) => Math.round(value * 100) === value * 100;

const fail = (gameId, message) => {
  throw new Error(`${gameId}: ${message}`);
};

const checkBets = (gameId, bets) => {
  if (!Array.isArray(bets) || !bets.length || bets.length > 8) fail(gameId, "bets must list 1 to 8 amounts");
  bets.forEach((bet) => {
    if (!Number.isInteger(bet) || bet < 1 || bet > 10_000) fail(gameId, `bet ${bet} must be a whole number of credits from 1 to 10000`);
  });
  if (new Set(bets).size !== bets.length) fail(gameId, "bets must not repeat");
};

// Throws on a bad model; returns its exact figures otherwise.
export function validateMath(gameId, math) {
  if (!ID.test(gameId)) fail(gameId, "game id must be lowercase letters, digits and dashes");
  if (!math || typeof math !== "object") fail(gameId, "math.json is missing");
  checkBets(gameId, math.bets);
  let figures;
  if (math.model === "weighted") {
    const { outcomes } = math;
    if (!Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 64) fail(gameId, "weighted needs 2 to 64 outcomes");
    const ids = new Set();
    let total = 0;
    let paid = 0;
    let hits = 0;
    for (const outcome of outcomes) {
      if (!OUTCOME_ID.test(outcome.id ?? "")) fail(gameId, `outcome id "${outcome.id}" must be lowercase letters, digits and dashes`);
      if (ids.has(outcome.id)) fail(gameId, `outcome "${outcome.id}" is listed twice`);
      ids.add(outcome.id);
      if (!Number.isInteger(outcome.weight) || outcome.weight < 1) fail(gameId, `outcome "${outcome.id}" needs a whole weight of at least 1`);
      const m = outcome.multiplier;
      if (typeof m !== "number" || m < 0 || m > MAX_MULTIPLIER || !CENTS(m)) fail(gameId, `outcome "${outcome.id}" multiplier must be 0 to ${MAX_MULTIPLIER} in steps of 0.01`);
      total += outcome.weight;
      paid += outcome.weight * m;
      if (m > 0) hits += outcome.weight;
    }
    if (total > 1_000_000_000) fail(gameId, "weights add up to more than a billion");
    figures = { rtp: paid / total, hitRate: hits / total, maxMultiplier: Math.max(...outcomes.map((o) => o.multiplier)) };
  } else if (math.model === "target") {
    const { targets, rtp } = math;
    if (typeof rtp !== "number") fail(gameId, "target needs an rtp");
    if (!Array.isArray(targets) || !targets.length || targets.length > 32) fail(gameId, "target needs 1 to 32 targets");
    targets.forEach((t) => {
      if (typeof t !== "number" || t <= 1 || t > 100 || !CENTS(t)) fail(gameId, `target ${t} must be above 1 and at most 100, in steps of 0.01`);
    });
    figures = { rtp, hitRate: rtp / Math.min(...targets), maxMultiplier: Math.max(...targets) };
  } else {
    fail(gameId, `unknown model "${math.model}" (use "weighted" or "target")`);
  }
  if (figures.rtp > MAX_RTP + 1e-12) fail(gameId, `return to player is ${(figures.rtp * 100).toFixed(2)}%, above the ${MAX_RTP * 100}% cap`);
  if (figures.rtp < MIN_RTP) fail(gameId, `return to player is ${(figures.rtp * 100).toFixed(2)}%, below the ${MIN_RTP * 100}% floor`);
  return figures;
}

// Draws one round. `rng(n)` returns an integer in [0, n); tests pass a fixed one.
export function drawRound(math, { target } = {}, rng = randomInt) {
  if (math.model === "weighted") {
    const total = math.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    let roll = rng(total);
    for (const outcome of math.outcomes) {
      if (roll < outcome.weight) return { outcome: outcome.id, multiplier: outcome.multiplier };
      roll -= outcome.weight;
    }
    throw new Error("weighted draw fell through");
  }
  if (math.model === "target") {
    const chosen = Number(target);
    if (!math.targets.includes(chosen)) throw new HttpError(400, "Choose one of the game's targets", "invalid_target");
    // u in (0, 1]; point = rtp / u, floored to cents: P(point ≥ t) = P(u ≤ rtp / t) = rtp / t.
    const u = (rng(1_000_000_000) + 1) / 1_000_000_000;
    const point = Math.min(MAX_MULTIPLIER, Math.max(1, Math.floor((math.rtp / u) * 100) / 100));
    const win = point >= chosen;
    return { outcome: win ? "win" : "lose", multiplier: win ? chosen : 0, value: point };
  }
  throw new Error(`unknown model ${math.model}`);
}

// What a game (and the lobby) may know about its math: never the weights.
export function publicMath(math, figures) {
  const base = { model: math.model, bets: math.bets, rtp: Math.round(figures.rtp * 10_000) / 10_000 };
  if (math.model === "weighted") return { ...base, outcomes: math.outcomes.map(({ id, multiplier }) => ({ id, multiplier })) };
  return { ...base, targets: math.targets };
}
