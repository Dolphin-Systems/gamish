import webpush from "web-push";
import { HttpError } from "./http.js";

// Web Push for admin chat alerts. The VAPID key pair is made on first use and kept in the
// database (server only), unless VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set.
const SUBJECT = process.env.VAPID_SUBJECT || "https://gamish777.vercel.app";
const SEND_TIMEOUT_MS = 4000;
let vapidPromise;

async function loadVapid(sql) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const read = async () => (await sql`SELECT value FROM app_secrets WHERE name = 'vapid' LIMIT 1`)[0]?.value;
  let stored = await read();
  if (!stored) {
    // Two cold starts may race here; the first insert wins and both read it back.
    await sql`INSERT INTO app_secrets (name, value) VALUES ('vapid', ${JSON.stringify(webpush.generateVAPIDKeys())}) ON CONFLICT (name) DO NOTHING`;
    stored = await read();
  }
  return JSON.parse(stored);
}

export function getVapid(sql) {
  if (!vapidPromise) vapidPromise = loadVapid(sql).catch((error) => { vapidPromise = undefined; throw error; });
  return vapidPromise;
}

export async function savePushSubscription(sql, playerId, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  let url;
  try { url = new URL(endpoint); } catch { url = null; }
  if (!url || url.protocol !== "https:" || endpoint.length > 1000 || !/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{8,100}$/.test(auth)) {
    throw new HttpError(400, "That notification subscription isn't valid", "invalid_subscription");
  }
  await sql`
    INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth)
    VALUES (${endpoint}, ${playerId}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET player_id = EXCLUDED.player_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
}

export async function removePushSubscription(sql, playerId, endpoint) {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${String(endpoint || "")} AND player_id = ${playerId}`;
}

// Sends one notification to every admin device. Never throws: a chat message must not fail
// because a push service is slow or a device unsubscribed (those subscriptions are removed).
export async function notifyAdmins(sql, payload) {
  try {
    const subscriptions = await sql`
      SELECT s.endpoint, s.p256dh, s.auth
      FROM push_subscriptions s JOIN players p ON p.id = s.player_id
      WHERE p.role = 'admin' AND p.deleted_at IS NULL
    `;
    if (!subscriptions.length) return 0;
    const vapid = await getVapid(sql);
    const options = {
      TTL: 3600,
      urgency: "high",
      timeout: SEND_TIMEOUT_MS,
      vapidDetails: { subject: SUBJECT, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    };
    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(subscriptions.map((row) =>
      webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, options)));
    const gone = subscriptions.filter((row, i) => [404, 410].includes(results[i].reason?.statusCode)).map((row) => row.endpoint);
    if (gone.length) await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${gone})`;
    return results.filter((result) => result.status === "fulfilled").length;
  } catch (error) {
    console.error("admin push failed", error?.message || error);
    return 0;
  }
}
