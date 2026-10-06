import { ensureSchema, getSql } from "./db.js";
import { bonusBudget } from "./house.js";
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

  // Same money measures for this range, the equal range before it, and today (report timezone).
  const periods = await sql`
    SELECT
      CASE
        WHEN created_at >= NOW() - (${days} * INTERVAL '1 day') THEN 'current'
        ELSE 'previous'
      END AS period,
      COALESCE(SUM(CASE
        WHEN entry_type = 'payment_credit' THEN cash_cents
        WHEN entry_type = 'admin_credit' THEN GREATEST(regular_delta, 0)
        ELSE 0
      END), 0) AS cash_in_cents,
      COALESCE(SUM(CASE WHEN entry_type = 'withdrawal' THEN ABS(cash_cents) ELSE 0 END), 0) AS cash_out_cents,
      COALESCE(SUM(CASE WHEN entry_type = 'game_bet' THEN -(regular_delta + bonus_delta) ELSE 0 END), 0) AS wagered,
      COALESCE(SUM(CASE WHEN entry_type = 'game_win' THEN regular_delta + bonus_delta ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN entry_type = 'bonus_credit' THEN bonus_delta ELSE 0 END), 0) AS bonuses,
      COUNT(*) FILTER (WHERE entry_type = 'game_bet') AS rounds,
      COUNT(DISTINCT player_id) FILTER (WHERE entry_type = 'game_bet') AS active_players
    FROM ledger_entries
    WHERE created_at >= NOW() - (${days * 2} * INTERVAL '1 day')
    GROUP BY period
  `;
  const [todayRow] = await sql`
    SELECT
      COALESCE(SUM(CASE
        WHEN entry_type = 'payment_credit' THEN cash_cents
        WHEN entry_type = 'admin_credit' THEN GREATEST(regular_delta, 0)
        ELSE 0
      END), 0) AS cash_in_cents,
      COALESCE(SUM(CASE WHEN entry_type = 'withdrawal' THEN ABS(cash_cents) ELSE 0 END), 0) AS cash_out_cents,
      COUNT(*) FILTER (WHERE entry_type = 'game_bet') AS rounds,
      COUNT(DISTINCT player_id) FILTER (WHERE entry_type = 'game_bet') AS active_players
    FROM ledger_entries
    WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})
  `;
  const periodTotals = (name) => {
    const row = periods.find((candidate) => candidate.period === name) || {};
    const cashIn = Number(row.cash_in_cents || 0);
    const cashOut = Number(row.cash_out_cents || 0);
    const wagered = Number(row.wagered || 0);
    const won = Number(row.won || 0);
    return {
      cashInCents: cashIn,
      cashOutCents: cashOut,
      netCashCents: cashIn - cashOut,
      gameNet: wagered - won - Number(row.bonuses || 0),
      wagered,
      rounds: Number(row.rounds || 0),
      activePlayers: Number(row.active_players || 0),
    };
  };

  const [pendingRow] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'deposit') AS deposits,
      COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'deposit'), 0) AS deposit_cents,
      COUNT(*) FILTER (WHERE kind = 'cashout') AS cashouts,
      COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'cashout'), 0) AS cashout_cents
    FROM payment_requests WHERE status = 'pending'
  `;
  const [unreadRow] = await sql`
    SELECT COUNT(*) AS unread, COUNT(DISTINCT m.player_id) AS conversations
    FROM support_messages m JOIN players p ON p.id = m.player_id
    WHERE m.sender_id = m.player_id AND m.read_at IS NULL AND p.deleted_at IS NULL
  `;

  // Money movements plus notable wins, newest first.
  const movements = await sql`
    SELECT l.id, l.entry_type, l.regular_delta, l.bonus_delta, l.cash_cents, l.reference, l.created_at, p.login_id
    FROM ledger_entries l JOIN players p ON p.id = l.player_id
    WHERE l.entry_type NOT IN ('game_bet', 'game_win')
    ORDER BY l.created_at DESC
    LIMIT 15
  `;
  const bigWins = await sql`
    SELECT r.id, r.bet, r.payout, r.multiplier, r.created_at, p.login_id
    FROM game_rounds r JOIN players p ON p.id = r.player_id
    WHERE r.multiplier >= 3
    ORDER BY r.created_at DESC
    LIMIT 3
  `;
  const activity = [
    ...movements.map((row) => ({
      id: row.id,
      type: row.entry_type,
      loginId: row.login_id,
      amountCents: row.entry_type === "withdrawal" ? Math.abs(Number(row.cash_cents)) : Number(row.regular_delta) + Number(row.bonus_delta),
      note: row.reference || "",
      createdAt: row.created_at,
    })),
    ...bigWins.map((row) => ({
      id: row.id,
      type: "big_win",
      loginId: row.login_id,
      amountCents: Number(row.payout),
      note: `${Number(row.multiplier)}× on a ${Number(row.bet)} credit spin`,
      createdAt: row.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 15);

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
    current: periodTotals("current"),
    previous: periodTotals("previous"),
    today: {
      cashInCents: Number(todayRow.cash_in_cents),
      cashOutCents: Number(todayRow.cash_out_cents),
      netCashCents: Number(todayRow.cash_in_cents) - Number(todayRow.cash_out_cents),
      rounds: Number(todayRow.rounds),
      activePlayers: Number(todayRow.active_players),
    },
    // What players currently hold: the most they could ask to cash out (bonus cash is not cashable).
    liability: normalizedPlayers.filter((player) => player.status !== "deleted").reduce((sum, player) => ({
      cashableCents: sum.cashableCents + player.regularCredits,
      bonusCents: sum.bonusCents + player.bonusCredits,
    }), { cashableCents: 0, bonusCents: 0 }),
    attention: {
      pendingDeposits: Number(pendingRow.deposits),
      pendingDepositCents: Number(pendingRow.deposit_cents),
      pendingCashouts: Number(pendingRow.cashouts),
      pendingCashoutCents: Number(pendingRow.cashout_cents),
      unreadMessages: Number(unreadRow.unread),
      unreadConversations: Number(unreadRow.conversations),
    },
    activity,
    summary: {
      activePlayers: normalizedPlayers.filter((player) => player.status === "active").length,
      frozenPlayers: normalizedPlayers.filter((player) => player.status === "suspended").length,
      lifetimeCashInCents: normalizedPlayers.reduce((sum, player) => sum + player.paidInCents, 0),
      lifetimeCashOutCents: normalizedPlayers.reduce((sum, player) => sum + player.paidOutCents, 0),
      periodCashInCents: normalizedDaily.reduce((sum, row) => sum + row.cashInCents, 0),
      periodCashOutCents: normalizedDaily.reduce((sum, row) => sum + row.cashOutCents, 0),
      periodGameNet: normalizedDaily.reduce((sum, row) => sum + row.gameNet, 0),
    },
    bonusPool: await bonusBudget(),
    gameModel: {
      theoreticalRtp: THEORETICAL_RTP,
      theoreticalHitRate: THEORETICAL_HIT_RATE,
      note: "Theoretical values describe long-run virtual-balance behavior and do not guarantee daily or weekly profit.",
    },
  };
}
