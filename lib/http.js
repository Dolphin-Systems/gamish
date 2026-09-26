export class HttpError extends Error {
  constructor(status, message, code = "request_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

export async function readRawBody(req, maxBytes = 128_000) {
  if (req.body !== undefined && req.body !== null) {
    const existing = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    if (existing.length > maxBytes) throw new HttpError(413, "Request body is too large", "body_too_large");
    return existing;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Request body is too large", "body_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON body", "invalid_json");
  }
}

export function requireMethod(req, methods) {
  const allowed = Array.isArray(methods) ? methods : [methods];
  if (!allowed.includes(req.method)) throw new HttpError(405, "Method not allowed", "method_not_allowed");
}

export function requireBrowserAction(req) {
  if (req.headers["x-gamish-action"] !== "1") {
    throw new HttpError(403, "Missing action confirmation header", "invalid_action");
  }
}

export function handleApiError(res, error) {
  if (error instanceof HttpError) return json(res, error.status, { error: error.code, message: error.message });
  console.error(error);
  return json(res, 500, { error: "server_error", message: "The server could not complete this request." });
}
