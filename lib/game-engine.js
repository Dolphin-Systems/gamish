import { ensureSchema, getSql } from "./db.js";
import { gameWindow, getGameSettings, roundMath } from "./game-control.js";
import { drawRound } from "./game-models.js";
import { GAME_MATH } from "./games.generated.js";
import { HttpError } from "./http.js";

// The server's side of every game round: check the request against the game's math and the
// admin's controls, then draw the outcome from the adjusted odds. Money moves in
// recordGameRound, in one transaction with the round and the house bank.
export function getGameMath(gameId) {
  const math = Object.hasOwn(GAME_MATH, gameId) ? GAME_MATH[gameId] : null;
  if (!math) throw new HttpError(404, "Unknown game", "unknown_game");
  return math;
}

export async function playRound(gameId, { bet, target }) {
  const math = getGameMath(gameId);
  const stake = Number(bet);
  if (!math.bets.includes(stake)) throw new HttpError(400, "Invalid bet", "invalid_bet");
  await ensureSchema();
  const [settings, window, [house]] = await Promise.all([
    getGameSettings(gameId),
    gameWindow(gameId),
    getSql()`SELECT balance_cents FROM house WHERE id = 1`,
  ]);
  if (!settings.enabled) throw new HttpError(423, "This game is paused right now", "game_paused");
  const { math: live, applied } = roundMath(gameId, { settings, window, houseBalance: Number(house.balance_cents), bet: stake });
  if (math.model === "target" && math.targets.includes(Number(target)) && !live.targets.includes(Number(target))) {
    throw new HttpError(409, "That target is limited right now, pick a lower one", "target_limited");
  }
  return { bet: stake, ...drawRound(live, { target }), applied };
}
