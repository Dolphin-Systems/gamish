import { getSessionPlayer } from "../lib/auth.js";
import { ensureSchema, getSql } from "../lib/db.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../lib/http.js";
import {
  approvePaymentRequest, cancelPaymentRequest, createPaymentRequest, declinePaymentRequest,
  listAdminRequests, listPlayerRequests,
} from "../lib/payment-requests.js";
import { randomUUID } from "../lib/security.js";

const clean = (value) => String(value || "").trim().replace(/\s+/g, " ");
const serialize = (row) => ({
  id: row.id,
  methodName: row.method_name,
  paymentId: row.payment_id,
  enabled: Boolean(row.enabled),
  isCurrent: Boolean(row.is_current),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const readAll = (sql) => sql`
  SELECT id, method_name, payment_id, enabled, is_current, created_at, updated_at
  FROM payment_methods
  ORDER BY LOWER(method_name), is_current DESC, enabled DESC, created_at ASC
`;

export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const account = await getSessionPlayer(req);
    await ensureSchema();
    const sql = getSql();

    // Deposit and cash-out requests share this function to stay within the plan's function limit.
    if (req.method === "GET" && new URL(req.url, "http://localhost").searchParams.get("requests")) {
      const status = new URL(req.url, "http://localhost").searchParams.get("status");
      const requests = account.role === "admin" ? await listAdminRequests({ status }) : await listPlayerRequests(account.id);
      return json(res, 200, { requests });
    }

    if (req.method === "GET" && new URL(req.url, "http://localhost").searchParams.get("flow")) {
      if (account.role !== "admin") throw new HttpError(403, "Admin access required", "forbidden");
      const rows = await sql`
        SELECT id, event_type, request_id, player_login_id, kind, amount_cents,
          payment_id, method_name, remark, status, wallet_delta_cents, created_at
        FROM payment_flow_logs
        ORDER BY created_at DESC
        LIMIT 500
      `;
      const events = rows.map((row) => ({
        id: row.request_id || row.id,
        eventId: row.id,
        source: row.event_type === "processor_completion" ? "processor_webhook"
          : row.event_type === "admin_completion" ? "admin_completion" : "player_request",
        player: row.player_login_id,
        kind: row.kind,
        amountCents: Number(row.amount_cents),
        paymentId: row.payment_id || "",
        methodName: row.method_name,
        remark: row.remark || "",
        status: row.status,
        completedAmountCents: Number(row.wallet_delta_cents) === 0 ? null : Math.abs(Number(row.wallet_delta_cents)),
        submittedAt: row.created_at,
        completedAt: Number(row.wallet_delta_cents) === 0 ? null : row.created_at,
        adminNote: row.event_type === "admin_completion" ? row.remark || "" : "",
      }));
      return json(res, 200, { events });
    }

    if (req.method === "GET") {
      if (account.role === "admin") {
        return json(res, 200, { methods: (await readAll(sql)).map(serialize) });
      }
      const rows = await sql`
        SELECT id, method_name, payment_id, enabled, is_current, created_at, updated_at
        FROM payment_methods
        WHERE enabled AND is_current
        ORDER BY LOWER(method_name)
      `;
      return json(res, 200, { methods: rows.map(serialize) });
    }

    requireBrowserAction(req);
    const body = await readJson(req);

    if (body.action === "request_create" && account.role === "player") {
      return json(res, 201, { request: await createPaymentRequest(account, body) });
    }
    if (body.action === "request_cancel" && account.role === "player") {
      return json(res, 200, { request: await cancelPaymentRequest(account, body.id) });
    }
    if (account.role !== "admin") throw new HttpError(403, "Admin access required", "forbidden");
    if (body.action === "request_approve") {
      return json(res, 200, await approvePaymentRequest(account, body.id, { amountCents: body.amountCents, note: body.note }));
    }
    if (body.action === "request_decline") {
      return json(res, 200, { request: await declinePaymentRequest(account, body.id, body.note) });
    }

    if (body.action === "create") {
      const methodName = clean(body.methodName);
      const paymentId = clean(body.paymentId);
      if (methodName.length < 2 || methodName.length > 32) {
        throw new HttpError(400, "Method name must contain 2–32 characters", "invalid_method_name");
      }
      if (paymentId.length < 2 || paymentId.length > 100) {
        throw new HttpError(400, "Payment ID must contain 2–100 characters", "invalid_payment_id");
      }
      const [current] = await sql`
        SELECT id FROM payment_methods
        WHERE LOWER(method_name) = LOWER(${methodName}) AND enabled AND is_current
        LIMIT 1
      `;
      try {
        const [row] = await sql`
          INSERT INTO payment_methods (id, method_name, payment_id, enabled, is_current)
          VALUES (${randomUUID()}, ${methodName}, ${paymentId}, TRUE, ${!current})
          RETURNING *
        `;
        return json(res, 201, { method: serialize(row) });
      } catch (error) {
        if (String(error.message).includes("payment_methods_identity_idx")) {
          throw new HttpError(409, "That payment ID already exists for this method", "payment_method_exists");
        }
        throw error;
      }
    }

    if (body.action === "select") {
      const [target] = await sql`
        SELECT id, method_name FROM payment_methods
        WHERE id = ${body.id} AND enabled
      `;
      if (!target) throw new HttpError(404, "Enabled payment ID not found", "payment_method_not_found");
      await sql.transaction([
        sql`UPDATE payment_methods SET is_current = FALSE, updated_at = NOW() WHERE LOWER(method_name) = LOWER(${target.method_name})`,
        sql`UPDATE payment_methods SET is_current = TRUE, updated_at = NOW() WHERE id = ${target.id}`,
      ]);
      return json(res, 200, { ok: true });
    }

    if (body.action === "rotate") {
      const methodName = clean(body.methodName);
      const rows = await sql`
        SELECT id, method_name, is_current
        FROM payment_methods
        WHERE LOWER(method_name) = LOWER(${methodName}) AND enabled
        ORDER BY created_at ASC, id ASC
      `;
      if (!rows.length) throw new HttpError(404, "No enabled IDs for this payment method", "payment_method_not_found");
      const currentIndex = rows.findIndex((row) => row.is_current);
      const next = rows[(currentIndex + 1 + rows.length) % rows.length];
      await sql.transaction([
        sql`UPDATE payment_methods SET is_current = FALSE, updated_at = NOW() WHERE LOWER(method_name) = LOWER(${rows[0].method_name})`,
        sql`UPDATE payment_methods SET is_current = TRUE, updated_at = NOW() WHERE id = ${next.id}`,
      ]);
      return json(res, 200, { ok: true, currentId: next.id });
    }

    if (body.action === "toggle") {
      const [target] = await sql`SELECT * FROM payment_methods WHERE id = ${body.id}`;
      if (!target) throw new HttpError(404, "Payment ID not found", "payment_method_not_found");
      if (target.enabled) {
        const [next] = target.is_current ? await sql`
          SELECT id FROM payment_methods
          WHERE LOWER(method_name) = LOWER(${target.method_name}) AND enabled AND id <> ${target.id}
          ORDER BY created_at ASC, id ASC LIMIT 1
        ` : [];
        const statements = [sql`UPDATE payment_methods SET enabled = FALSE, is_current = FALSE, updated_at = NOW() WHERE id = ${target.id}`];
        if (next) statements.push(sql`UPDATE payment_methods SET is_current = TRUE, updated_at = NOW() WHERE id = ${next.id}`);
        await sql.transaction(statements);
      } else {
        const [current] = await sql`
          SELECT id FROM payment_methods
          WHERE LOWER(method_name) = LOWER(${target.method_name}) AND enabled AND is_current LIMIT 1
        `;
        await sql`
          UPDATE payment_methods
          SET enabled = TRUE, is_current = ${!current}, updated_at = NOW()
          WHERE id = ${target.id}
        `;
      }
      return json(res, 200, { ok: true });
    }

    if (body.action === "remove") {
      const [target] = await sql`SELECT * FROM payment_methods WHERE id = ${body.id}`;
      if (!target) throw new HttpError(404, "Payment ID not found", "payment_method_not_found");
      const [next] = target.is_current ? await sql`
        SELECT id FROM payment_methods
        WHERE LOWER(method_name) = LOWER(${target.method_name}) AND enabled AND id <> ${target.id}
        ORDER BY created_at ASC, id ASC LIMIT 1
      ` : [];
      const statements = [sql`DELETE FROM payment_methods WHERE id = ${target.id}`];
      if (next) statements.push(sql`UPDATE payment_methods SET is_current = TRUE, updated_at = NOW() WHERE id = ${next.id}`);
      await sql.transaction(statements);
      return json(res, 200, { ok: true });
    }

    throw new HttpError(400, "Unknown payment method action", "unknown_action");
  } catch (error) {
    return handleApiError(res, error);
  }
}
