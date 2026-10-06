import { HttpError } from "./http.js";

// Where a player receives cash-outs, keyed by payment app ("Cash App" -> "$ricky").
const MAX_METHODS = 10;
const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

export function sanitizePayoutHandles(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Payment usernames are missing", "invalid_handles");
  }
  const handles = {};
  for (const [rawName, rawHandle] of Object.entries(input)) {
    const name = clean(rawName);
    const handle = clean(rawHandle);
    if (!handle) continue; // an emptied field removes that username
    if (name.length < 2 || name.length > 32) throw new HttpError(400, "Payment app names must be 2 to 32 characters", "invalid_handles");
    if (handle.length < 2 || handle.length > 100) throw new HttpError(400, `${name} username must be 2 to 100 characters`, "invalid_handles");
    handles[name] = handle;
  }
  if (Object.keys(handles).length > MAX_METHODS) throw new HttpError(400, "Too many payment usernames", "invalid_handles");
  return handles;
}

export function readPayoutHandles(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === "object" ? value : {};
}
