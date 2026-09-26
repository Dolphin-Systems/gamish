import { authenticateLogin, createSession, publicPlayer } from "../../lib/auth.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { validateLoginId, validatePin } from "../../lib/security.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireBrowserAction(req);
    const { loginId, pin } = await readJson(req);
    if (!validateLoginId(loginId) || !validatePin(pin)) {
      throw new HttpError(400, "Enter a valid login ID and 4–8 digit PIN", "invalid_credentials_format");
    }
    const player = await authenticateLogin(loginId, pin, req);
    await createSession(player.id, res);
    return json(res, 200, { player: publicPlayer(player) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
