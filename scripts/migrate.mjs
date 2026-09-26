import { hashPin, normalizeLoginId, randomUUID, validateLoginId, validatePin } from "../lib/security.js";

// Schema changes should use Neon's direct connection rather than the pooled
// application URL. Vercel's Neon integration supplies both values.
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const { ensureSchema, getSql } = await import("../lib/db.js");

await ensureSchema();

const loginId = process.env.ADMIN_LOGIN_ID;
const pin = process.env.ADMIN_INITIAL_PIN;

if (loginId || pin) {
  if (!validateLoginId(loginId) || !validatePin(pin)) {
    throw new Error("ADMIN_LOGIN_ID or ADMIN_INITIAL_PIN has an invalid format");
  }
  const credentials = await hashPin(pin);
  await getSql()`
    INSERT INTO players (id, login_id, login_id_normalized, pin_salt, pin_hash, role)
    VALUES (${randomUUID()}, ${loginId}, ${normalizeLoginId(loginId)}, ${credentials.salt}, ${credentials.hash}, 'admin')
    ON CONFLICT (login_id_normalized) DO UPDATE SET
      pin_salt = EXCLUDED.pin_salt,
      pin_hash = EXCLUDED.pin_hash,
      role = 'admin',
      status = 'active',
      updated_at = NOW()
  `;
  console.log(`Admin account ready: ${loginId}`);
} else {
  console.log("Schema ready. No admin account was seeded.");
}
