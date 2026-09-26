import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export { randomUUID };

export function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateLoginId(value) {
  return /^[A-Za-z][A-Za-z0-9]{4,19}$/.test(String(value || ""));
}

export function validatePin(value) {
  return /^\d{4,8}$/.test(String(value || ""));
}

export async function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(String(pin), salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

export async function verifyPin(pin, salt, expectedHex) {
  const { hash } = await hashPin(pin, salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = String(signature).replace(/^sha256=/, "");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function parseCookies(header = "") {
  return Object.fromEntries(String(header).split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}
