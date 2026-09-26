import { ensureSchema, getSql } from "../lib/db.js";
import { handleApiError, json, requireMethod } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await ensureSchema();
    const [row] = await getSql()`SELECT NOW() AS server_time`;
    return json(res, 200, { ok: true, database: true, serverTime: row.server_time });
  } catch (error) {
    return handleApiError(res, error);
  }
}
