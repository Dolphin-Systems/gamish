import { getSessionPlayer } from "../../lib/auth.js";
import { BET_OPTIONS, buildResultMarks, drawOutcome } from "../../lib/game-math.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { recordGameRound } from "../../lib/ledger.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireBrowserAction(req);
    const player = await getSessionPlayer(req);
    const { bet } = await readJson(req);
    if (!BET_OPTIONS.includes(Number(bet))) throw new HttpError(400, "Invalid bet", "invalid_bet");
    const multiplier = drawOutcome();
    const marks = buildResultMarks(multiplier);
    const round = await recordGameRound({ playerId: player.id, bet: Number(bet), multiplier, marks });
    // Only what the reels need: outcome, marks and the new wallet.
    return json(res, 200, {
      round: { roundId: round.roundId, bet: round.bet, multiplier: round.multiplier, payout: round.payout, marks: round.marks, wallet: round.wallet },
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
