import { getSessionPlayer } from "../../lib/auth.js";
import { getSql } from "../../lib/db.js";
import { playRound } from "../../lib/game-engine.js";
import { buildResultMarks } from "../../lib/game-math.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { recordGameRound } from "../../lib/ledger.js";
import { randomUUID } from "../../lib/security.js";

const GAME_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const EVENT_NAME = /^[A-Za-z0-9_.:-]{1,40}$/;

// Every game plays through here: the central math draws the outcome, the ledger moves the
// credits, and the round is recorded under the game's id. Games also report events here
// (action "event"), which keeps the deployment within its serverless function limit.
export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireBrowserAction(req);
    const player = await getSessionPlayer(req);
    const body = await readJson(req, 8_000);
    const gameId = body.gameId ?? "phoenix-ruby";
    if (typeof gameId !== "string" || !GAME_ID.test(gameId)) throw new HttpError(400, "Unknown game", "unknown_game");

    if (body.action === "event") {
      if (typeof body.name !== "string" || !EVENT_NAME.test(body.name)) throw new HttpError(400, "Event names are 1 to 40 letters, digits or _.:-", "invalid_event");
      const data = JSON.stringify(body.data && typeof body.data === "object" ? body.data : {});
      if (data.length > 2_000) throw new HttpError(413, "Event data is too large", "event_too_large");
      await getSql()`
        INSERT INTO game_events (id, player_id, game_id, name, data)
        VALUES (${randomUUID()}, ${player.id}, ${gameId}, ${body.name}, ${data}::jsonb)
      `;
      return json(res, 200, { ok: true });
    }

    const { bet, outcome, multiplier, value } = playRound(gameId, body);
    // Phoenix Ruby's built-in reels draw the symbol grid the server picks for its outcome.
    const marks = gameId === "phoenix-ruby" ? buildResultMarks(multiplier) : undefined;
    const round = await recordGameRound({ playerId: player.id, gameId, outcome, bet, multiplier, marks });
    return json(res, 200, {
      round: {
        roundId: round.roundId, gameId, bet: round.bet, outcome, multiplier: round.multiplier, payout: round.payout,
        ...(value === undefined ? {} : { value }), ...(marks ? { marks } : {}), wallet: round.wallet,
      },
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
