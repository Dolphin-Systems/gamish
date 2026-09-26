import { ensureSchema, getSql } from "./db.js";
import { HttpError } from "./http.js";
import {
  createSessionToken,
  digest,
  normalizeLoginId,
  parseCookies,
  randomUUID,
  verifyPin,
} from "./security.js";

const SESSION_COOKIE = "gamish_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function publicPlayer(row) {
  const regularCredits = Number(row.regular_credits || 0);
  const bonusCredits = Number(row.bonus_credits || 0);
  return {
    id: row.id,
    loginId: row.login_id,
    role: row.role,
    status: row.status,
    regularCredits,
    bonusCredits,
    totalCredits: regularCredits + bonusCredits,
  };
}

export async function authenticateLogin(loginId, pin, req) {
  await ensureSchema();
  const sql = getSql();
  const normalized = normalizeLoginId(loginId);
  const forwarded = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const attemptKey = digest(`${normalized}:${forwarded}`);
  const [attempt] = await sql`
    SELECT failed_count, blocked_until
    FROM login_attempts
    WHERE attempt_key = ${attemptKey}
  `;

  if (attempt?.blocked_until && new Date(attempt.blocked_until) > new Date()) {
    throw new HttpError(429, "Too many attempts. Try again in 15 minutes.", "login_blocked");
  }

  const [player] = await sql`
    SELECT * FROM players
    WHERE login_id_normalized = ${normalized}
    LIMIT 1
  `;
  const valid = player && player.status === "active" && await verifyPin(pin, player.pin_salt, player.pin_hash);

  if (!valid) {
    await sql`
      INSERT INTO login_attempts (attempt_key, failed_count, window_started_at, blocked_until)
      VALUES (${attemptKey}, 1, NOW(), NULL)
      ON CONFLICT (attempt_key) DO UPDATE SET
        failed_count = CASE
          WHEN login_attempts.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1
          ELSE login_attempts.failed_count + 1
        END,
        window_started_at = CASE
          WHEN login_attempts.window_started_at < NOW() - INTERVAL '15 minutes' THEN NOW()
          ELSE login_attempts.window_started_at
        END,
        blocked_until = CASE
          WHEN (
            CASE
              WHEN login_attempts.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1
              ELSE login_attempts.failed_count + 1
            END
          ) >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END
    `;
    throw new HttpError(401, "Incorrect login ID or PIN", "invalid_login");
  }

  await sql`DELETE FROM login_attempts WHERE attempt_key = ${attemptKey}`;
  await sql`UPDATE players SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${player.id}`;
  return player;
}

export async function createSession(playerId, res) {
  await ensureSchema();
  const sql = getSql();
  const token = createSessionToken();
  await sql`
    INSERT INTO sessions (id, token_hash, player_id, expires_at)
    VALUES (${randomUUID()}, ${digest(token)}, ${playerId}, NOW() + INTERVAL '7 days')
  `;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`);
}

export async function getSessionPlayer(req, options = {}) {
  await ensureSchema();
  const sql = getSql();
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) throw new HttpError(401, "Sign in required", "unauthorized");

  const [player] = await sql`
    SELECT p.*
    FROM sessions s
    JOIN players p ON p.id = s.player_id
    WHERE s.token_hash = ${digest(token)}
      AND s.expires_at > NOW()
      AND p.status = 'active'
    LIMIT 1
  `;
  if (!player) throw new HttpError(401, "Session expired", "unauthorized");
  if (options.role && player.role !== options.role) throw new HttpError(403, "Admin access required", "forbidden");
  return player;
}

export async function clearSession(req, res) {
  await ensureSchema();
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await getSql()`DELETE FROM sessions WHERE token_hash = ${digest(token)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
