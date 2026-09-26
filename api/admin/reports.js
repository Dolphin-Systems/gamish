import { getSessionPlayer } from "../../lib/auth.js";
import { handleApiError, json, requireMethod } from "../../lib/http.js";
import { getAdminReport } from "../../lib/reports.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await getSessionPlayer(req, { role: "admin" });
    const requestedDays = Number(req.query?.days || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    return json(res, 200, await getAdminReport({ days }));
  } catch (error) {
    return handleApiError(res, error);
  }
}
