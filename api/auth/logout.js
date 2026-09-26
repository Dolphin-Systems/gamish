import { clearSession } from "../../lib/auth.js";
import { handleApiError, json, requireBrowserAction, requireMethod } from "../../lib/http.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireBrowserAction(req);
    await clearSession(req, res);
    return json(res, 200, { ok: true });
  } catch (error) {
    return handleApiError(res, error);
  }
}
