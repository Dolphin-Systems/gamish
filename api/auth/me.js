import { getSessionPlayer, publicPlayer } from "../../lib/auth.js";
import { handleApiError, json, requireMethod } from "../../lib/http.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    const player = await getSessionPlayer(req);
    return json(res, 200, { player: publicPlayer(player) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
