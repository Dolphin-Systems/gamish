# Gamish777 backend

Gamish777 uses Vercel Functions and Neon Postgres for authenticated virtual-credit play. It is not a real-money gambling or withdrawal system.

## Accounts

- Every player signs in with an admin-created login ID and a 4–8 digit PIN.
- PINs are stored as salted scrypt hashes.
- Sessions use opaque, HTTP-only, SameSite cookies and expire after seven days.
- Five failed login attempts within 15 minutes temporarily block that login/IP pair.
- Login portals are role-bound: player credentials are accepted only from the game login, and admin credentials only from `/admin.html`.
- The admin dashboard at `/admin.html` has Overview, Players, Player Analytics, Money, and Reports pages.
- The `/admin.html` dashboard can be installed as a separate **Gamish777 Admin** PWA on supported desktop and mobile browsers.
- Admins can create players, reset PINs, freeze access, soft-delete accounts, add available or bonus cash, record cash out, and reset a test balance to zero.
- Admins can manage player-facing payment methods from the wallet icon: add multiple IDs per method, select the live ID, disable IDs, or rotate to the next enabled ID without redeploying.
- The Players page also has a guarded testing-only hard reset. It requires two confirmations and permanently removes every active or archived player account, lifetime total, payment, payment-method setting, ledger entry, game round, chat, session, and login-attempt record. Only admin accounts remain, and the admin is signed out after completion.
- Deleted accounts cannot sign in, while their lifetime ledger history remains available for audit reports.

## Ledger and reports

Every balance change is recorded in an append-only ledger. Game wagers and wins are committed atomically with the wallet update. The admin display uses dollars throughout, with one internal cent equal to one game balance unit.

Reports can be filtered to 7, 30, or 90 days and downloaded as a generated PDF. The PDF includes cash in, cash out, game net, account status, current balances, and lifetime player totals.

Player Analytics uses the same 7, 30, or 90 day ranges to show active players, rounds, observed win rate and return, daily wager/win trends, and a per-player activity ranking. These observed values describe completed virtual-credit play in the selected range.

## Deposit and cash-out requests

Players request money movements from the Wallet page instead of just refreshing their balance:

- **Deposit:** the player picks an amount and a method. They see the live payment ID with a copy button, send the money, and tap **I've sent it**. The request records the payment ID they were shown, plus an optional reference note.
- **Cash out:** the player asks for up to their cashable balance, minus any cash-outs already pending. Bonus credits are not cashable. The player gives the method and their own handle.
- Each player can have at most three pending requests of each kind, and can cancel a request while it is pending.

Admins work the queue in **Money → Deposits and cash-outs**:

- **Confirm & credit** records a `payment_credit` for the amount actually received, which the admin can edit. It then adds the advertised reload bonus ($20 → $5, $50 → $10, $100 → $25), capped by the weekly bonus pool.
- **Mark as sent** records a `withdrawal`, and fails if the player's cashable balance is now too low.
- **Decline** takes a reason, which the player sees.

A request is claimed atomically before any ledger entry is written, and every ledger entry uses the idempotency key `request:<id>`. A request can never be applied twice. A failed debit returns the request to pending.

To stay within the Vercel Hobby limit of 12 functions, requests are served by `/api/payment-methods` (`?requests=1` and the `request_*` actions).

## Admin overview

The Overview page shows:

- What needs attention: deposits to confirm, cash-outs to send and unread messages.
- Today's cash in and out.
- Six KPIs compared with the previous period of the same length: net cash, cash in, cash out, cashable balances owed to players, game net and players who played.
- A daily cash-flow chart and a recent-activity feed.

Clicking any player name opens a detail drawer with balances, lifetime totals, requests and money history.

## Chat

Player support messages are stored in Postgres. Players can write from the Messages page, while admins can select a player and reply from the chat button in the dashboard header. Both sides get Sent/Seen receipts, day separators and a live unread badge. `/api/messages?summary=1` is a cheap unread counter, and open threads poll only for messages newer than the last one they hold (`after=`). Admins also get canned replies, Unread and Has-requests filters, and a context bar showing the player's balance and pending requests. Both sides can attach JPEG, PNG, or WebP images; the browser compresses them before upload, stored images are limited to 1 MB, image uploads are rate-limited, and image bytes are served only through an authenticated endpoint.

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

## Games platform

Games live in `games/<id>/` (see `games/README.md`). The server's central math is
`lib/game-models.js` (models, RTP rules, crypto RNG), fed by `lib/games.generated.js`, which
`npm run games` generates from every `games/*/math.json`. `POST /api/game/spin` with
`{ gameId, bet, target? }` plays a round for any game (no `gameId` means Phoenix Ruby), and
`{ gameId, action: "event", name, data }` records what a game reports (`game_events`). Rounds
are stored with their `game_id` and `outcome`.
