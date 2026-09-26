# Gamish777 backend

Gamish777 uses Vercel Functions and Neon Postgres for authenticated virtual-credit play. It is not a real-money gambling or withdrawal system.

## Accounts

- Every player signs in with an admin-created login ID and a 4–8 digit PIN.
- PINs are stored as salted scrypt hashes.
- Sessions use opaque, HTTP-only, SameSite cookies and expire after seven days.
- Five failed login attempts within 15 minutes temporarily block that login/IP pair.
- The admin dashboard at `/admin.html` has Overview, Players, Player Analytics, Money, and Reports pages.
- The same dashboard is available at `/admin` and can be installed as a separate **Gamish777 Admin** PWA on supported desktop and mobile browsers.
- Admins can create players, reset PINs, freeze access, soft-delete accounts, add available or bonus cash, record cash out, and reset a test balance to zero.
- The Players page also has a guarded testing-only hard reset. It requires two confirmations and permanently removes every active or archived player account, lifetime total, payment, ledger entry, game round, chat, session, and login-attempt record. Only admin accounts remain, and the admin is signed out after completion.
- Deleted accounts cannot sign in, while their lifetime ledger history remains available for audit reports.

## Ledger and reports

Every balance change is recorded in an append-only ledger. Game wagers and wins are committed atomically with the wallet update. The admin display uses dollars throughout, with one internal cent equal to one game balance unit.

Reports can be filtered to 7, 30, or 90 days and downloaded as a generated PDF. The PDF includes cash in, cash out, game net, account status, current balances, and lifetime player totals.

Player Analytics uses the same 7, 30, or 90 day ranges to show active players, rounds, observed win rate and return, daily wager/win trends, and a per-player activity ranking. These observed values describe completed virtual-credit play in the selected range.

Player support messages are stored in Postgres. Players can write from the Messages page, while admins can select a player and reply from the chat button in the dashboard header.

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
