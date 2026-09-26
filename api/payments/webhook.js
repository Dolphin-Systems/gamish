import { ensureSchema, getSql } from "../../lib/db.js";
import { handleApiError, HttpError, json, readRawBody, requireMethod } from "../../lib/http.js";
import { creditPlayer } from "../../lib/ledger.js";
import { digest, normalizeLoginId, randomUUID, verifyWebhookSignature } from "../../lib/security.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    const rawBody = await readRawBody(req);
    if (!verifyWebhookSignature(rawBody, req.headers["x-gamish-signature"])) {
      throw new HttpError(401, "Invalid webhook signature", "invalid_signature");
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new HttpError(400, "Invalid webhook payload", "invalid_payload");
    }

    if (event.type !== "payment.received" || event.status !== "succeeded") {
      return json(res, 202, { received: true, credited: false });
    }
    const cashCents = Number(event.amountCents);
    if (!event.id || !event.playerId || !Number.isInteger(cashCents) || cashCents < 100 || cashCents > 100_000) {
      throw new HttpError(400, "Webhook fields are invalid", "invalid_payment_event");
    }

    await ensureSchema();
    const sql = getSql();
    const [player] = await sql`
      SELECT id FROM players
      WHERE login_id_normalized = ${normalizeLoginId(event.playerId)}
        AND role = 'player'
        AND status = 'active'
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!player) throw new HttpError(404, "Player not found", "player_not_found");

    const provider = String(event.provider || "custom").slice(0, 40);
    const providerEventId = String(event.id).slice(0, 120);
    const providerEventKey = `${provider}:${providerEventId}`;
    const creditAmount = cashCents;
    const result = await creditPlayer({
      playerId: player.id,
      regular: creditAmount,
      entryType: "payment_credit",
      reference: `${provider}:${providerEventId}`,
      idempotencyKey: `payment:${provider}:${providerEventId}`,
      cashCents,
    });

    await sql`
      INSERT INTO payment_events (
        id, provider, provider_event_id, player_login_id, cash_cents,
        credit_amount, status, payload_digest, ledger_entry_id, processed_at
      )
      VALUES (
        ${randomUUID()}, ${provider}, ${providerEventKey}, ${String(event.playerId).slice(0, 40)},
        ${cashCents}, ${creditAmount}, 'succeeded', ${digest(rawBody)}, ${result.ledgerId || null}, NOW()
      )
      ON CONFLICT (provider_event_id) DO NOTHING
    `;

    return json(res, 200, { received: true, credited: result.applied, wallet: result.wallet });
  } catch (error) {
    return handleApiError(res, error);
  }
}
