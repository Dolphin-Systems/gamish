import { ensureSchema, getSql } from "./db.js";
import { baseRtp, effectiveMath, MAX_RTP, maxTunableRtp, MIN_RTP, validateMath } from "./game-models.js";
import { GAME_INFO, GAME_MATH } from "./games.generated.js";
import { ensureRegistry, isGameEnabled } from "./game-registry.js";
import { HttpError } from "./http.js";

// The admin's live controls over each game (the Nerd page) and the figures behind them.
export const DEFAULT_MAX_WIN_CENTS = 10_000; // $100 on any single round
export const DEFAULT_DAILY_LIMIT_CENTS = 20_000; // $200 net paid out per 24 hours, per game
const WINDOW = "24 hours";

const settingsFrom = (row) => ({
  rtp: row?.rtp === null || row?.rtp === undefined ? null : Number(row.rtp),
  maxWinCents: row?.max_win_cents ? Number(row.max_win_cents) : DEFAULT_MAX_WIN_CENTS,
  dailyLimitCents: row?.daily_limit_cents ? Number(row.daily_limit_cents) : DEFAULT_DAILY_LIMIT_CENTS,
  enabled: row ? Boolean(row.enabled) : true,
  updatedAt: row?.updated_at ?? null,
});

// On/off lives in the game registry (the Games page); Nerd's switch writes the same field.
export async function getGameSettings(gameId) {
  await ensureSchema();
  const [[row], enabled] = await Promise.all([
    getSql()`SELECT * FROM game_settings WHERE game_id = ${gameId}`,
    isGameEnabled(gameId),
  ]);
  return { ...settingsFrom(row), enabled };
}

export async function saveGameSettings(gameId, input, adminId) {
  const math = GAME_MATH[gameId];
  if (!math) throw new HttpError(404, "Unknown game", "unknown_game");
  const ceiling = maxTunableRtp(math);
  const rtp = input.rtp === null || input.rtp === undefined ? null : Number(input.rtp);
  if (rtp !== null && !(rtp >= MIN_RTP && rtp <= ceiling + 1e-9)) {
    throw new HttpError(400, `RTP for this game must be ${(MIN_RTP * 100).toFixed(0)}% to ${(ceiling * 100).toFixed(2)}%`, "invalid_rtp");
  }
  const cents = (value, name) => {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 100 || amount > 100_000_000) throw new HttpError(400, `${name} must be from $1 to $1,000,000`, "invalid_amount");
    return amount;
  };
  const maxWinCents = cents(input.maxWinCents, "Max win");
  const dailyLimitCents = cents(input.dailyLimitCents, "Daily payout limit");
  const enabled = input.enabled !== false;
  await ensureRegistry();
  await getSql()`UPDATE games SET enabled = ${enabled}, updated_at = NOW() WHERE id = ${gameId}`;
  await getSql()`
    INSERT INTO game_settings (game_id, rtp, max_win_cents, daily_limit_cents, enabled, updated_by, updated_at)
    VALUES (${gameId}, ${rtp === null ? null : Math.round(rtp * 10_000) / 10_000}, ${maxWinCents}, ${dailyLimitCents}, ${enabled}, ${adminId}, NOW())
    ON CONFLICT (game_id) DO UPDATE SET
      rtp = EXCLUDED.rtp, max_win_cents = EXCLUDED.max_win_cents, daily_limit_cents = EXCLUDED.daily_limit_cents,
      enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
  return getGameSettings(gameId);
}

// Net paid out by a game over the last 24 hours (payouts − bets; negative when it is earning).
export async function gameWindow(gameId) {
  const [row] = await getSql()`
    SELECT COUNT(*)::INTEGER AS rounds, COALESCE(SUM(bet), 0) AS wagered, COALESCE(SUM(payout), 0) AS paid
    FROM game_rounds WHERE game_id = ${gameId} AND created_at >= NOW() - ${WINDOW}::INTERVAL
  `;
  const wagered = Number(row.wagered);
  const paid = Number(row.paid);
  return { rounds: row.rounds, wagered, paid, net: paid - wagered };
}

// Everything the engine needs to draw one round of this game for this bet.
export function roundMath(gameId, { settings, window, houseBalance, bet }) {
  const math = GAME_MATH[gameId];
  const usage = Math.max(0, window.net) / settings.dailyLimitCents;
  const maxWin = Math.min(settings.maxWinCents, houseBalance + bet);
  return effectiveMath(math, { targetRtp: settings.rtp, maxWin, usage, bet });
}

// The Nerd page: each game's math, controls, live state and who is winning.
export async function controlRoom(houseBalance) {
  await ensureRegistry();
  const sql = getSql();
  const settingsRows = await sql`SELECT * FROM game_settings`;
  const settingsById = new Map(settingsRows.map((row) => [row.game_id, row]));
  const enabledRows = await sql`SELECT id, enabled FROM games`;
  const enabledById = new Map(enabledRows.map((row) => [row.id, Boolean(row.enabled)]));
  const stats = await sql`
    SELECT game_id,
      COUNT(*) FILTER (WHERE created_at >= NOW() - ${WINDOW}::INTERVAL)::INTEGER AS rounds_day,
      COALESCE(SUM(bet) FILTER (WHERE created_at >= NOW() - ${WINDOW}::INTERVAL), 0) AS wagered_day,
      COALESCE(SUM(payout) FILTER (WHERE created_at >= NOW() - ${WINDOW}::INTERVAL), 0) AS paid_day,
      COUNT(*)::INTEGER AS rounds_all, COALESCE(SUM(bet), 0) AS wagered_all, COALESCE(SUM(payout), 0) AS paid_all
    FROM game_rounds GROUP BY game_id
  `;
  const statsById = new Map(stats.map((row) => [row.game_id, row]));
  const winners = await sql`
    SELECT r.game_id, r.player_id, p.login_id, SUM(r.payout - r.bet) AS net, COUNT(*)::INTEGER AS rounds
    FROM game_rounds r JOIN players p ON p.id = r.player_id
    WHERE r.created_at >= NOW() - ${WINDOW}::INTERVAL
    GROUP BY r.game_id, r.player_id, p.login_id
    HAVING SUM(r.payout - r.bet) > 0
    ORDER BY net DESC
  `;
  return Object.entries(GAME_MATH).map(([id, math]) => {
    const settings = { ...settingsFrom(settingsById.get(id)), enabled: enabledById.get(id) ?? false };
    const row = statsById.get(id) || {};
    const day = { rounds: row.rounds_day || 0, wagered: Number(row.wagered_day || 0), paid: Number(row.paid_day || 0) };
    const all = { rounds: row.rounds_all || 0, wagered: Number(row.wagered_all || 0), paid: Number(row.paid_all || 0) };
    day.net = day.paid - day.wagered;
    const bet = math.bets[0];
    const { applied } = roundMath(id, { settings, window: day, houseBalance, bet });
    const figures = validateMath(id, math);
    return {
      id,
      ...GAME_INFO[id],
      model: math.model,
      bets: math.bets,
      maxMultiplier: figures.maxMultiplier,
      baseRtp: baseRtp(math),
      minRtp: MIN_RTP,
      maxRtp: Math.min(MAX_RTP, maxTunableRtp(math)),
      settings,
      live: {
        targetRtp: applied.targetRtp,
        effectiveRtp: applied.effectiveRtp,
        throttle: applied.throttle,
        usage: Math.max(0, day.net) / settings.dailyLimitCents,
      },
      day: { ...day, observedRtp: day.wagered ? day.paid / day.wagered : null },
      all: { ...all, observedRtp: all.wagered ? all.paid / all.wagered : null },
      topWinners: winners.filter((winner) => winner.game_id === id).slice(0, 5)
        .map((winner) => ({ playerId: winner.player_id, loginId: winner.login_id, netCents: Number(winner.net), rounds: winner.rounds })),
    };
  });
}
