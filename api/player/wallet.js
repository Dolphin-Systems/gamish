import { getSessionPlayer, publicPlayer } from "../../lib/auth.js";
import { getSql } from "../../lib/db.js";
import { handleApiError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { getWallet } from "../../lib/ledger.js";
import { sanitizePayoutHandles } from "../../lib/payout-handles.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const player = await getSessionPlayer(req);
    if (req.method === "POST") {
      // Profile: save the usernames the player gets paid at, so cash-outs fill them in.
      requireBrowserAction(req);
      const body = await readJson(req, 8_000);
      const handles = sanitizePayoutHandles(body.payoutHandles);
      const sql = getSql();
      const [row] = await sql`
        UPDATE players SET payout_handles = ${JSON.stringify(handles)}::jsonb, updated_at = NOW()
        WHERE id = ${player.id}
        RETURNING *
      `;
      return json(res, 200, { player: publicPlayer(row) });
    }
    const wallet = await getWallet(player.id);
    return json(res, 200, { loginId: player.login_id, wallet });
  } catch (error) {
    return handleApiError(res, error);
  }
}
