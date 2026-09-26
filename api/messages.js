import { getSessionPlayer } from "../lib/auth.js";
import { ensureSchema, getSql } from "../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../lib/http.js";
import { MAX_MESSAGE_REQUEST_BYTES, parseImageAttachment } from "../lib/message-images.js";
import { randomUUID } from "../lib/security.js";

const normalizeMessage = (row) => ({
  id: row.id,
  playerId: row.player_id,
  senderId: row.sender_id,
  senderRole: row.sender_role,
  body: row.body,
  attachment: row.attachment_type ? {
    url: `/api/messages?imageId=${encodeURIComponent(row.id)}`,
    type: row.attachment_type,
    name: row.attachment_name || "Chat image",
  } : null,
  createdAt: row.created_at,
  readAt: row.read_at,
});

const safeFilename = (value) => String(value || "chat-image.jpg").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "chat-image.jpg";

async function serveMessageImage({ req, res, sql, account, id }) {
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
  const etag = `"chat-image-${id}"`;
  if (req.headers["if-none-match"] === etag) {
    res.statusCode = 304;
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("ETag", etag);
    return res.end();
  }
  const bytes = Buffer.from(image.attachment_data, "base64");
  res.statusCode = 200;
  res.setHeader("Content-Type", image.attachment_type);
  res.setHeader("Content-Length", bytes.length);
  res.setHeader("Content-Disposition", `inline; filename="${safeFilename(image.attachment_name)}"`);
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("ETag", etag);
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.end(bytes);
}

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const account = await getSessionPlayer(req);
    await ensureSchema();
    const sql = getSql();
    const url = new URL(req.url, "http://localhost");

    const imageId = url.searchParams.get("imageId");
    if (req.method === "GET" && imageId) {
      return await serveMessageImage({ req, res, sql, account, id: imageId });
    }

    if (req.method === "GET" && account.role === "admin" && !url.searchParams.get("playerId")) {
      const rows = await sql`
        SELECT
          p.id, p.login_id, p.status,
          MAX(m.created_at) AS last_message_at,
          COUNT(m.id) FILTER (WHERE m.sender_id = p.id AND m.read_at IS NULL) AS unread_count,
          (ARRAY_AGG(m.body ORDER BY m.created_at DESC) FILTER (WHERE m.id IS NOT NULL))[1] AS last_message
        FROM players p
        LEFT JOIN support_messages m ON m.player_id = p.id
        WHERE p.role = 'player' AND p.deleted_at IS NULL
        GROUP BY p.id
        ORDER BY last_message_at DESC NULLS LAST, p.login_id ASC
      `;
      return json(res, 200, {
        conversations: rows.map((row) => ({
          playerId: row.id,
          loginId: row.login_id,
          status: row.status,
          lastMessage: row.last_message || "",
          lastMessageAt: row.last_message_at,
          unreadCount: Number(row.unread_count),
        })),
      });
    }

    const body = req.method === "POST" ? await readJson(req, MAX_MESSAGE_REQUEST_BYTES) : {};
    const requestedPlayerId = req.method === "GET" ? url.searchParams.get("playerId") : body.playerId;
    const playerId = account.role === "admin" ? requestedPlayerId : account.id;
    if (!playerId) throw new HttpError(400, "Choose a player", "player_required");

    const [player] = await sql`
      SELECT id, login_id, status
      FROM players
      WHERE id = ${playerId} AND role = 'player' AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!player) throw new HttpError(404, "Player not found", "player_not_found");

    if (req.method === "POST") {
      requireBrowserAction(req);
      const message = String(body.message || "").trim();
      const attachment = parseImageAttachment(body.attachment);
      if ((!message && !attachment) || message.length > 500) {
        throw new HttpError(400, "Add a message or image, with no more than 500 text characters", "invalid_message");
      }
      if (attachment) {
        const [usage] = await sql`
          SELECT COUNT(*)::INTEGER AS image_count
          FROM support_messages
          WHERE sender_id = ${account.id}
            AND attachment_data IS NOT NULL
            AND created_at > NOW() - INTERVAL '1 hour'
        `;
        if (Number(usage.image_count) >= 20) {
          throw new HttpError(429, "Image limit reached. Try again later", "image_rate_limited");
        }
      }
      const storedBody = message || "Photo";
      const [created] = await sql`
        INSERT INTO support_messages (id, player_id, sender_id, body, attachment_type, attachment_name, attachment_data)
        VALUES (${randomUUID()}, ${player.id}, ${account.id}, ${storedBody}, ${attachment?.type || null}, ${attachment?.name || null}, ${attachment?.data || null})
        RETURNING id, player_id, sender_id, body, attachment_type, attachment_name, created_at, read_at
      `;
      return json(res, 201, {
        message: normalizeMessage({ ...created, sender_role: account.role }),
      });
    }

    await sql`
      UPDATE support_messages
      SET read_at = NOW()
      WHERE player_id = ${player.id} AND sender_id <> ${account.id} AND read_at IS NULL
    `;
    const messages = await sql`
      SELECT
        m.id, m.player_id, m.sender_id, m.body, m.attachment_type, m.attachment_name,
        m.created_at, m.read_at, sender.role AS sender_role
      FROM support_messages m
      JOIN players sender ON sender.id = m.sender_id
      WHERE m.player_id = ${player.id}
      ORDER BY m.created_at ASC
      LIMIT 200
    `;
    return json(res, 200, {
      player: { id: player.id, loginId: player.login_id, status: player.status },
      messages: messages.map(normalizeMessage),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
