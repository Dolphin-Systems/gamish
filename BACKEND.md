# Gamish777 backend

Gamish777 uses Vercel Functions and Neon Postgres for authenticated virtual-credit play. It is not a real-money gambling or withdrawal system.

## Accounts

- Every player signs in with an admin-created login ID and a 4–8 digit PIN.
- PINs are stored as salted scrypt hashes.
- Sessions use opaque, HTTP-only, SameSite cookies and expire after seven days.
- Five failed login attempts within 15 minutes temporarily block that login/IP pair.
- The admin can create players, reset PINs, suspend access, and grant regular or bonus credits at `/admin.html`.

## Ledger and reports

Every credit change is recorded in an append-only ledger. Game wagers and wins are committed atomically with the wallet update. The admin report separates cash notifications, wagers, wins, game net, bonuses, and player balances.

The current Phoenix game has a fixed theoretical 40% hit rate and 80% virtual-credit RTP. These long-run theoretical values do not guarantee profit for any day or week.

## Payment notification contract

Send a `POST` request to `/api/payments/webhook` with the raw JSON body and an `x-gamish-signature` header. The signature is the lowercase hexadecimal HMAC-SHA256 of the exact request body using `PAYMENT_WEBHOOK_SECRET`.

```json
{
  "id": "provider-event-id",
  "type": "payment.received",
  "status": "succeeded",
  "playerId": "Ricky123",
  "amountCents": 500,
  "provider": "custom"
}
```

Successful notifications map one cent to one virtual credit. Event IDs are idempotent, so a retry does not credit the player twice. Production payment integrations should additionally verify the provider's native signature and event by calling the provider API.

## Environment

Copy `.env.example` for local development and supply:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` (used by migrations)
- `PAYMENT_WEBHOOK_SECRET`

Run `npm run db:migrate` to create the schema, `npm test` for the game-math tests, and `vercel dev` for the complete local app.
