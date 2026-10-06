import { drawRound } from "./game-models.js";
import { GAME_MATH } from "./games.generated.js";
import { HttpError } from "./http.js";

// The server's view of the catalogue: math per game id, generated from games/*/math.json.
export function getGameMath(gameId) {
  const math = Object.hasOwn(GAME_MATH, gameId) ? GAME_MATH[gameId] : null;
  if (!math) throw new HttpError(404, "Unknown game", "unknown_game");
  return math;
}

// Validates the request against the game's math and draws the outcome. Money moves elsewhere
// (recordGameRound), in one transaction with the round.
export function playRound(gameId, { bet, target }) {
  const math = getGameMath(gameId);
  const stake = Number(bet);
  if (!math.bets.includes(stake)) throw new HttpError(400, "Invalid bet", "invalid_bet");
  return { bet: stake, ...drawRound(math, { target }) };
}
