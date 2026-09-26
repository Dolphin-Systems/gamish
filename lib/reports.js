import { ensureSchema, getSql } from "./db.js";
import { getWeeklyBonusPool } from "./ledger.js";
import { THEORETICAL_HIT_RATE, THEORETICAL_RTP } from "./game-math.js";

export async function getAdminReport({ days = 30 } = {}) {
  await ensureSchema();
  const sql = getSql();
  const timezone = process.env.REPORT_TIMEZONE || "America/Chicago";

  const daily = await sql`
    SELECT
      (created_at AT TIME ZONE ${timezone})::DATE AS report_date,
      COALESCE(SUM(CASE
        WHEN entry_type = 'payment_credit' THEN cash_cents
        WHEN entry_type = 'admin_credit' THEN GREATEST(regular_delta, 0)
        ELSE 0
      END), 0) AS cash_in_cents,
      COALESCE(SUM(CASE WHEN entry_type = 'withdrawal' THEN ABS(cash_cents) ELSE 0 END), 0) AS cash_out_cents,
      COALESCE(SUM(CASE WHEN entry_type = 'game_bet' THEN -(regular_delta + bonus_delta) ELSE 0 END), 0) AS wagered,
      COALESCE(SUM(CASE WHEN entry_type = 'game_win' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN entry_type = 'admin_credit' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS admin_credits,
      COALESCE(SUM(CASE WHEN entry_type = 'payment_credit' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS payment_credits,
      COALESCE(SUM(CASE WHEN entry_type = 'bonus_credit' THEN bonus_delta ELSE 0 END), 0) AS bonuses,
      COUNT(*) FILTER (WHERE entry_type = 'game_bet') AS rounds,
      COUNT(*) FILTER (WHERE entry_type = 'game_win') AS winning_rounds,
      COUNT(DISTINCT player_id) FILTER (WHERE entry_type IN ('game_bet', 'game_win')) AS active_players
    FROM ledger_entries
    WHERE created_at >= NOW() - (${days} * INTERVAL '1 day')
    GROUP BY report_date
    ORDER BY report_date DESC
  `;

  const playerAnalytics = await sql`
    WITH ledger_period AS (
      SELECT
        player_id,
        COALESCE(SUM(CASE
          WHEN entry_type = 'payment_credit' THEN cash_cents
          WHEN entry_type = 'admin_credit' THEN GREATEST(regular_delta, 0)
          ELSE 0
        END), 0) AS cash_in_cents,
        COALESCE(SUM(CASE WHEN entry_type = 'withdrawal' THEN ABS(cash_cents) ELSE 0 END), 0) AS cash_out_cents,
        COALESCE(SUM(CASE WHEN entry_type = 'game_bet' THEN -(regular_delta + bonus_delta) ELSE 0 END), 0) AS wagered,
        COALESCE(SUM(CASE WHEN entry_type = 'game_win' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS won,
        COUNT(*) FILTER (WHERE entry_type = 'game_bet') AS rounds,
        COUNT(*) FILTER (WHERE entry_type = 'game_win') AS winning_rounds,
        MAX(created_at) FILTER (WHERE entry_type IN ('game_bet', 'game_win')) AS last_played_at
      FROM ledger_entries
      WHERE created_at >= NOW() - (${days} * INTERVAL '1 day')
      GROUP BY player_id
    )
    SELECT
      p.id, p.login_id, p.status, p.deleted_at,
      COALESCE(lp.cash_in_cents, 0) AS cash_in_cents,
      COALESCE(lp.cash_out_cents, 0) AS cash_out_cents,
      COALESCE(lp.wagered, 0) AS wagered,
      COALESCE(lp.won, 0) AS won,
      COALESCE(lp.rounds, 0) AS rounds,
      COALESCE(lp.winning_rounds, 0) AS winning_rounds,
      lp.last_played_at
    FROM players p
    LEFT JOIN ledger_period lp ON lp.player_id = p.id
    WHERE p.role = 'player'
    ORDER BY wagered DESC, cash_in_cents DESC, p.login_id ASC
  `;

  const players = await sql`
    SELECT
      p.id, p.login_id, p.status, p.deleted_at, p.regular_credits, p.bonus_credits,
      COALESCE(SUM(CASE
        WHEN l.entry_type = 'payment_credit' THEN l.cash_cents
        WHEN l.entry_type = 'admin_credit' THEN GREATEST(l.regular_delta, 0)
        ELSE 0
      END), 0) AS paid_in_cents,
      COALESCE(SUM(CASE WHEN l.entry_type = 'withdrawal' THEN ABS(l.cash_cents) ELSE 0 END), 0) AS paid_out_cents,
      COALESCE(SUM(CASE WHEN l.entry_type = 'game_bet' THEN -(l.regular_delta + l.bonus_delta) ELSE 0 END), 0) AS wagered,
      COALESCE(SUM(CASE WHEN l.entry_type = 'game_win' THEN l.regular_delta + l.bonus_delta ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN l.entry_type = 'bonus_credit' THEN l.bonus_delta ELSE 0 END), 0) AS bonus_received
    FROM players p
    LEFT JOIN ledger_entries l ON l.player_id = p.id
    WHERE p.role = 'player'
    GROUP BY p.id
    ORDER BY paid_in_cents DESC, p.login_id ASC
  `;

  const normalizedDaily = daily.map((row) => ({
    date: row.report_date,
    cashInCents: Number(row.cash_in_cents),
    cashOutCents: Number(row.cash_out_cents),
    cashNetCents: Number(row.cash_in_cents) - Number(row.cash_out_cents),
    wagered: Number(row.wagered),
    won: Number(row.won),
    gameNet: Number(row.wagered) - Number(row.won) - Number(row.bonuses),
    adminCredits: Number(row.admin_credits),
    paymentCredits: Number(row.payment_credits),
    bonuses: Number(row.bonuses),
    rounds: Number(row.rounds),
    winningRounds: Number(row.winning_rounds),
    activePlayers: Number(row.active_players),
  }));

  const normalizedPlayers = players.map((row) => ({
    id: row.id,
    loginId: row.login_id,
    status: row.deleted_at ? "deleted" : row.status,
    regularCredits: Number(row.regular_credits),
    bonusCredits: Number(row.bonus_credits),
    totalCredits: Number(row.regular_credits) + Number(row.bonus_credits),
    paidInCents: Number(row.paid_in_cents),
    paidOutCents: Number(row.paid_out_cents),
    wagered: Number(row.wagered),
    won: Number(row.won),
    bonusReceived: Number(row.bonus_received),
  }));

  const normalizedPlayerAnalytics = playerAnalytics.map((row) => {
    const wagered = Number(row.wagered);
    const won = Number(row.won);
    const rounds = Number(row.rounds);
    const winningRounds = Number(row.winning_rounds);
    return {
      id: row.id,
      loginId: row.login_id,
      status: row.deleted_at ? "deleted" : row.status,
      cashInCents: Number(row.cash_in_cents),
      cashOutCents: Number(row.cash_out_cents),
      wagered,
      won,
      gameNet: wagered - won,
      rounds,
      winningRounds,
      winRate: rounds ? winningRounds / rounds : 0,
      returnRate: wagered ? won / wagered : 0,
      lastPlayedAt: row.last_played_at,
    };
  });

  const activePlayerAnalytics = normalizedPlayerAnalytics.filter((player) => player.rounds > 0);
  const totalRounds = normalizedPlayerAnalytics.reduce((sum, player) => sum + player.rounds, 0);
  const totalWinningRounds = normalizedPlayerAnalytics.reduce((sum, player) => sum + player.winningRounds, 0);
  const totalWagered = normalizedPlayerAnalytics.reduce((sum, player) => sum + player.wagered, 0);
  const totalWon = normalizedPlayerAnalytics.reduce((sum, player) => sum + player.won, 0);

  return {
    timezone,
    days,
    generatedAt: new Date().toISOString(),
    daily: normalizedDaily,
    players: normalizedPlayers,
    playerAnalytics: normalizedPlayerAnalytics,
    analytics: {
      activePlayers: activePlayerAnalytics.length,
      totalRounds,
      winningRounds: totalWinningRounds,
      winRate: totalRounds ? totalWinningRounds / totalRounds : 0,
      wagered: totalWagered,
      won: totalWon,
      returnRate: totalWagered ? totalWon / totalWagered : 0,
    },
    summary: {
      activePlayers: normalizedPlayers.filter((player) => player.status === "active").length,
      frozenPlayers: normalizedPlayers.filter((player) => player.status === "suspended").length,
      lifetimeCashInCents: normalizedPlayers.reduce((sum, player) => sum + player.paidInCents, 0),
      lifetimeCashOutCents: normalizedPlayers.reduce((sum, player) => sum + player.paidOutCents, 0),
      periodCashInCents: normalizedDaily.reduce((sum, row) => sum + row.cashInCents, 0),
      periodCashOutCents: normalizedDaily.reduce((sum, row) => sum + row.cashOutCents, 0),
      periodGameNet: normalizedDaily.reduce((sum, row) => sum + row.gameNet, 0),
    },
    bonusPool: await getWeeklyBonusPool(),
    gameModel: {
      theoreticalRtp: THEORETICAL_RTP,
      theoreticalHitRate: THEORETICAL_HIT_RATE,
      note: "Theoretical values describe long-run virtual-balance behavior and do not guarantee daily or weekly profit.",
    },
  };
}
