import { authenticateLogin, createSession, publicPlayer } from "../../lib/auth.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { validateLoginId, validatePin } from "../../lib/security.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireBrowserAction(req);
    const { loginId, pin, portal } = await readJson(req);
    if (!validateLoginId(loginId) || !validatePin(pin)) {
      throw new HttpError(400, "Enter a valid login ID and 4–8 digit PIN", "invalid_credentials_format");
    }
    if (!["player", "admin"].includes(portal)) {
      throw new HttpError(400, "Choose a valid login portal", "invalid_login_portal");
    }
    const player = await authenticateLogin(loginId, pin, req);
    if (portal === "player" && player.role === "admin") {
      throw new HttpError(403, "Admins sign in at /admin.html", "admin_portal_required");
    }
    if (portal === "admin" && player.role !== "admin") {
      throw new HttpError(403, "Player accounts sign in from the game", "player_portal_required");
    }
    await createSession(player.id, res);
    return json(res, 200, { player: publicPlayer(player) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
