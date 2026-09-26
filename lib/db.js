import { neon } from "@neondatabase/serverless";

let sqlClient;
let schemaPromise;

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

  await sql`CREATE INDEX IF NOT EXISTS sessions_player_idx ON sessions(player_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_player_time_idx ON ledger_entries(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_time_idx ON ledger_entries(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS rounds_player_time_idx ON game_rounds(player_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS players_active_idx ON players(role, status) WHERE deleted_at IS NULL`;
}
