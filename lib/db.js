import { neon } from "@neondatabase/serverless";

let sqlClient;
let schemaPromise;

// The house bank's starting amount until the admin picks one ($1,000 unless HOUSE_START_DOLLARS says otherwise).
export const HOUSE_START_CENTS = Math.round((Number(process.env.HOUSE_START_DOLLARS) || 1000) * 100);

export function getSql() {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

export function ensureSchema() {
  if (!schemaPromise) schemaPromise = createSchema().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}

async function createSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY,
      login_id TEXT NOT NULL,
      login_id_normalized TEXT NOT NULL UNIQUE,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      regular_credits INTEGER NOT NULL DEFAULT 0 CHECK (regular_credits >= 0),
      bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `;

  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS payout_handles JSONB NOT NULL DEFAULT '{}'::jsonb`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      attempt_key TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      blocked_until TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id UUID PRIMARY KEY,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      entry_type TEXT NOT NULL CHECK (entry_type IN (
        'payment_credit', 'admin_credit', 'bonus_credit', 'game_bet',
        'game_win', 'withdrawal', 'adjustment'
      )),
      regular_delta INTEGER NOT NULL DEFAULT 0,
      bonus_delta INTEGER NOT NULL DEFAULT 0,
      cash_cents INTEGER NOT NULL DEFAULT 0,
      reference TEXT,
      idempotency_key TEXT UNIQUE,
      created_by UUID REFERENCES players(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id UUID PRIMARY KEY,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      bet INTEGER NOT NULL CHECK (bet > 0),
      multiplier NUMERIC(5, 2) NOT NULL CHECK (multiplier >= 0),
      payout INTEGER NOT NULL CHECK (payout >= 0),
      regular_spent INTEGER NOT NULL CHECK (regular_spent >= 0),
      bonus_spent INTEGER NOT NULL CHECK (bonus_spent >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'phoenix-ruby'`;
  await sql`ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS outcome TEXT`;

  // The house bank: the admin's money that games pay wins from and bets go into. It starts at
  // the amount the admin picks (capital) and can never go below zero; profit (balance above
  // capital) is the only source of bonuses. Every change outside a game round is in house_ledger.
  await sql`
    CREATE TABLE IF NOT EXISTS house (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      capital_cents BIGINT NOT NULL CHECK (capital_cents >= 0),
      balance_cents BIGINT NOT NULL CHECK (balance_cents >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO house (id, capital_cents, balance_cents)
    VALUES (1, ${HOUSE_START_CENTS}, ${HOUSE_START_CENTS})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS house_ledger (
      id UUID PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('start', 'capital', 'withdraw', 'bonus')),
      amount_cents BIGINT NOT NULL,
      balance_after_cents BIGINT NOT NULL,
      reference TEXT,
      created_by UUID REFERENCES players(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Admin controls per game (Nerd page). Missing values use the game's math.json and defaults.
  await sql`
    CREATE TABLE IF NOT EXISTS game_settings (
      game_id TEXT PRIMARY KEY,
      rtp NUMERIC(6, 4) CHECK (rtp IS NULL OR (rtp >= 0.5 AND rtp <= 0.97)),
      max_win_cents INTEGER CHECK (max_win_cents IS NULL OR max_win_cents > 0),
      daily_limit_cents INTEGER CHECK (daily_limit_cents IS NULL OR daily_limit_cents > 0),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by UUID REFERENCES players(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // The game registry: every lobby tile, playable or coming soon (lib/game-registry.js).
  await sql`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
      name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
      category TEXT NOT NULL,
      art_cell JSONB,
      logo_mime TEXT,
      logo_data TEXT,
      logo_version INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;

  // What games report back through the SDK (Gamish.track): small, per player, per game.
  await sql`
    CREATE TABLE IF NOT EXISTS game_events (
      id UUID PRIMARY KEY,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payment_events (
      id UUID PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL UNIQUE,
      player_login_id TEXT NOT NULL,
      cash_cents INTEGER NOT NULL CHECK (cash_cents > 0),
      credit_amount INTEGER NOT NULL CHECK (credit_amount > 0),
      status TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      ledger_entry_id UUID REFERENCES ledger_entries(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;

  // Append-only audit trail for each step in the user → admin/processor → wallet flow.
  await sql`
    CREATE TABLE IF NOT EXISTS payment_flow_logs (
      id UUID PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      request_id UUID,
      player_id UUID,
      player_login_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('deposit', 'cashout')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      payment_id TEXT,
      method_name TEXT NOT NULL,
      remark TEXT,
      status TEXT NOT NULL,
      wallet_delta_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS payment_flow_logs_created_idx ON payment_flow_logs(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS payment_flow_logs_request_idx ON payment_flow_logs(request_id, created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID PRIMARY KEY,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      sender_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `;

  await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT`;
  await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT`;
  await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS attachment_data TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id UUID PRIMARY KEY,
      method_name TEXT NOT NULL CHECK (char_length(method_name) BETWEEN 2 AND 32),
      payment_id TEXT NOT NULL CHECK (char_length(payment_id) BETWEEN 2 AND 100),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      is_current BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id UUID PRIMARY KEY,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('deposit', 'cashout')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      bonus_cents INTEGER NOT NULL DEFAULT 0 CHECK (bonus_cents >= 0),
      credited_cents INTEGER,
      method_name TEXT NOT NULL,
      payment_handle TEXT,
      player_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
      admin_note TEXT,
      ledger_entry_id UUID REFERENCES ledger_entries(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ,
      decided_by UUID REFERENCES players(id) ON DELETE SET NULL
    )
  `;

  // Import existing records once so the new audit tab doesn't appear empty after upgrading.
  const [flowBackfill] = await sql`SELECT name FROM schema_migrations WHERE name = 'payment-flow-log-v1'`;
  if (!flowBackfill) {
    await sql`
    INSERT INTO payment_flow_logs (
      id, event_key, event_type, request_id, player_id, player_login_id, kind,
      amount_cents, payment_id, method_name, remark, status, wallet_delta_cents, created_at
    )
    SELECT gen_random_uuid(), 'legacy-request:' || r.id::text, 'request_snapshot', r.id,
      r.player_id, p.login_id, r.kind, r.amount_cents, r.payment_handle, r.method_name,
      COALESCE(r.admin_note, r.player_note), r.status,
      CASE WHEN r.status = 'approved' AND r.kind = 'deposit' THEN COALESCE(r.credited_cents, r.amount_cents)
        WHEN r.status = 'approved' AND r.kind = 'cashout' THEN -COALESCE(r.credited_cents, r.amount_cents) ELSE 0 END,
      r.created_at
    FROM payment_requests r JOIN players p ON p.id = r.player_id
    WHERE p.role = 'player'
    ON CONFLICT (event_key) DO NOTHING
    `;
    await sql`
    INSERT INTO payment_flow_logs (
      id, event_key, event_type, player_id, player_login_id, kind, amount_cents,
      payment_id, method_name, remark, status, wallet_delta_cents, created_at
    )
    SELECT gen_random_uuid(), 'legacy-webhook:' || e.provider_event_id, 'processor_completion',
      p.id, e.player_login_id, 'deposit', e.cash_cents, e.provider_event_id, e.provider,
      'Imported processor event', e.status, e.credit_amount, COALESCE(e.processed_at, e.created_at)
    FROM payment_events e
    LEFT JOIN players p ON p.login_id_normalized = LOWER(e.player_login_id)
    ON CONFLICT (event_key) DO NOTHING
    `;
    await sql`INSERT INTO schema_migrations (name) VALUES ('payment-flow-log-v1') ON CONFLICT DO NOTHING`;
  }

  await sql`CREATE INDEX IF NOT EXISTS sessions_player_idx ON sessions(player_id)`;
  await sql`CREATE INDEX IF NOT EXISTS payment_requests_status_idx ON payment_requests(status, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS payment_requests_player_idx ON payment_requests(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_player_time_idx ON ledger_entries(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_time_idx ON ledger_entries(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS rounds_player_time_idx ON game_rounds(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS rounds_game_time_idx ON game_rounds(game_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS game_events_game_time_idx ON game_events(game_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS messages_player_time_idx ON support_messages(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS messages_unread_idx ON support_messages(player_id, read_at) WHERE read_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS players_active_idx ON players(role, status) WHERE deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_identity_idx ON payment_methods (LOWER(method_name), LOWER(payment_id))`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_current_idx ON payment_methods (LOWER(method_name)) WHERE enabled AND is_current`;
  await sql`CREATE INDEX IF NOT EXISTS payment_methods_enabled_idx ON payment_methods (enabled, method_name, created_at)`;
}
