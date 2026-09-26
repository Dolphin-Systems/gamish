import { getSessionPlayer } from "../lib/auth.js";
import { ensureSchema, getSql } from "../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../lib/http.js";
import { randomUUID } from "../lib/security.js";

const normalizeMessage = (row) => ({
  id: row.id,
  playerId: row.player_id,
  senderId: row.sender_id,
  senderRole: row.sender_role,
  body: row.body,
  createdAt: row.created_at,
  readAt: row.read_at,
});

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const account = await getSessionPlayer(req);
    await ensureSchema();
    const sql = getSql();
    const url = new URL(req.url, "http://localhost");

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

    const body = req.method === "POST" ? await readJson(req) : {};
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
      if (!message || message.length > 500) {
        throw new HttpError(400, "Message must contain 1–500 characters", "invalid_message");
      }
      const [created] = await sql`
        INSERT INTO support_messages (id, player_id, sender_id, body)
        VALUES (${randomUUID()}, ${player.id}, ${account.id}, ${message})
        RETURNING *
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
      SELECT m.*, sender.role AS sender_role
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
