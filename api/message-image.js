import { getSessionPlayer } from "../lib/auth.js";
import { ensureSchema, getSql } from "../lib/db.js";
import { handleApiError, HttpError, requireMethod } from "../lib/http.js";

const safeFilename = (value) => String(value || "chat-image.jpg").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "chat-image.jpg";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    const account = await getSessionPlayer(req);
    await ensureSchema();
    const sql = getSql();
    const id = new URL(req.url, "http://localhost").searchParams.get("id");
    if (!id) throw new HttpError(400, "Image ID is required", "image_id_required");

    const rows = account.role === "admin"
      ? await sql`
          SELECT attachment_data, attachment_type, attachment_name
          FROM support_messages
          WHERE id = ${id} AND attachment_data IS NOT NULL
          LIMIT 1
        `
      : await sql`
          SELECT attachment_data, attachment_type, attachment_name
          FROM support_messages
          WHERE id = ${id} AND player_id = ${account.id} AND attachment_data IS NOT NULL
          LIMIT 1
        `;
    if (!rows.length) throw new HttpError(404, "Image not found", "image_not_found");
    const image = rows[0];
    const bytes = Buffer.from(image.attachment_data, "base64");
    const etag = `"chat-image-${id}"`;
    if (req.headers["if-none-match"] === etag) {
      res.statusCode = 304;
      res.setHeader("Cache-Control", "private, no-cache");
      res.setHeader("ETag", etag);
      return res.end();
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", image.attachment_type);
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename(image.attachment_name)}"`);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("ETag", etag);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(bytes);
  } catch (error) {
    return handleApiError(res, error);
  }
}
