import { getSessionPlayer } from "../../lib/auth.js";
import { handleApiError, json, requireMethod } from "../../lib/http.js";
import { getWallet } from "../../lib/ledger.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    const player = await getSessionPlayer(req);
    const wallet = await getWallet(player.id);
    return json(res, 200, { loginId: player.login_id, wallet });
  } catch (error) {
    return handleApiError(res, error);
  }
}
