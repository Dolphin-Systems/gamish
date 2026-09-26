const loginPanel = document.getElementById("admin-login");
const dashboard = document.getElementById("admin-dashboard");
const notice = document.getElementById("admin-notice");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
let players = [];
let report = null;
let noticeTimer;
let installPrompt;
let chatTimer;

const pageCopy = {
  overview: ["Overview", "A quick look at today."],
  players: ["Players", "Create, freeze, reset, or delete player accounts."],
  analytics: ["Player analytics", "Understand player activity and game performance."],
  money: ["Money", "Manage available cash and cash-out records."],
  reports: ["Reports", "Review activity and download a PDF."],
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json", "X-Gamish-Action": "1" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request failed");
  return payload;
};

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
const dollarsToCents = (value) => Math.round(Number(value) * 100);
const date = (value) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never";
const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;
const time = (value) => new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const setNotice = (message, error = false) => {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.classList.toggle("error", error);
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4200);
};

const openTab = (name, updateHash = true) => {
  const tab = pageCopy[name] ? name : "overview";
  document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  [pageTitle.textContent, pageDescription.textContent] = pageCopy[tab];
  if (updateHash && window.location.hash !== `#${tab}`) history.pushState(null, "", `#${tab}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.querySelectorAll("[data-tab], [data-open-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.tab || button.dataset.openTab)));
window.addEventListener("hashchange", () => openTab(window.location.hash.slice(1), false));

const statusPill = (status) => `<span class="status-pill ${status}">${status === "suspended" ? "Frozen" : status}</span>`;

const renderRecentPlayers = () => {
  const node = document.getElementById("recent-players");
  const recent = players.filter((player) => player.role === "player" && player.status !== "deleted").slice(0, 5);
  node.innerHTML = recent.map((player) => `
    <div class="mini-player"><div><b>${player.loginId}</b><small>${date(player.createdAt)}</small></div>${statusPill(player.status)}<strong>${money(player.totalCredits)}</strong></div>
  `).join("") || "<p class='helper'>No player accounts yet.</p>";
};

const playerActions = (player) => {
  if (player.status === "deleted") return "<span class='helper'>History retained</span>";
  return `
    <div class="row-actions">
      <button class="mini-button" type="button" data-action="pin" data-id="${player.id}">PIN</button>
      <button class="mini-button" type="button" data-action="status" data-id="${player.id}">${player.status === "active" ? "Freeze" : "Unfreeze"}</button>
      <button class="mini-button" type="button" data-action="reset" data-id="${player.id}">Test reset</button>
      <button class="mini-button danger" type="button" data-action="delete" data-id="${player.id}">Delete</button>
    </div>`;
};

const renderPlayers = () => {
  const query = document.getElementById("player-search").value.trim().toLowerCase();
  const matchingPlayers = players.filter((player) => player.role === "player" && player.loginId.toLowerCase().includes(query));
  const rows = matchingPlayers.filter((player) => player.status !== "deleted");
  const archived = matchingPlayers.filter((player) => player.status === "deleted");
  document.getElementById("players-table").innerHTML = rows.map((player) => `
    <tr>
      <td data-label="Player"><div class="player-name"><span class="avatar">${player.loginId[0].toUpperCase()}</span><div><b>${player.loginId}</b><small>Created ${date(player.createdAt)}</small></div></div></td>
      <td data-label="Status">${statusPill(player.status)}</td>
      <td data-label="Available" class="money">${money(player.totalCredits)}</td>
      <td data-label="Lifetime in" class="money">${money(player.lifetimeCashInCents)}</td>
      <td data-label="Lifetime out" class="money">${money(player.lifetimeCashOutCents)}</td>
      <td data-label="Manage">${playerActions(player)}</td>
    </tr>
  `).join("") || "<tr><td colspan='6'>No matching players.</td></tr>";

  document.getElementById("archived-players-table").innerHTML = archived.map((player) => `
    <tr>
      <td data-label="Player"><div class="player-name"><span class="avatar archived">${player.loginId[0].toUpperCase()}</span><div><b>${player.loginId}</b><small>Created ${date(player.createdAt)}</small></div></div></td>
      <td data-label="Archived">${date(player.deletedAt)}</td>
      <td data-label="Last login">${date(player.lastLoginAt)}</td>
      <td data-label="Account"><span class="status-pill deleted">Archived</span></td>
    </tr>
  `).join("") || "<tr><td colspan='4'>No archived accounts.</td></tr>";

  const activePlayers = players.filter((player) => player.role === "player" && player.status !== "deleted");
  for (const select of [document.getElementById("credit-player-id"), document.getElementById("cashout-player-id")]) {
    const selected = select.value;
    select.replaceChildren(...activePlayers.map((player) => new Option(`${player.loginId} · ${money(player.totalCredits)}`, player.id)));
    if (activePlayers.some((player) => player.id === selected)) select.value = selected;
  }

  document.getElementById("cashflow-table").innerHTML = rows.map((player) => `
    <tr><td data-label="Player"><b>${player.loginId}</b></td><td data-label="Available" class="money">${money(player.totalCredits)}</td><td data-label="Cash in" class="money">${money(player.lifetimeCashInCents)}</td><td data-label="Cash out" class="money">${money(player.lifetimeCashOutCents)}</td><td data-label="Net cash" class="money">${money(player.lifetimeCashInCents - player.lifetimeCashOutCents)}</td></tr>
  `).join("") || "<tr><td colspan='5'>No player cash flow yet.</td></tr>";
  renderRecentPlayers();
};

const renderReport = () => {
  if (!report) return;
  document.getElementById("period-cash-in").textContent = money(report.summary.periodCashInCents);
  document.getElementById("cash-flow-note").textContent = `${money(report.summary.periodCashOutCents)} out`;
  document.getElementById("period-game-net").textContent = money(report.summary.periodGameNet);
  document.getElementById("active-players").textContent = report.summary.activePlayers;
  document.getElementById("frozen-players").textContent = `${report.summary.frozenPlayers} frozen`;
  document.getElementById("bonus-pool").textContent = money(report.bonusPool.available);
  document.getElementById("game-model-note").textContent = `${(report.gameModel.theoreticalHitRate * 100).toFixed(0)}% theoretical hit rate and ${(report.gameModel.theoreticalRtp * 100).toFixed(0)}% theoretical return. ${report.gameModel.note}`;
  document.getElementById("daily-report-title").textContent = `Last ${report.days} days`;

  document.getElementById("daily-table").innerHTML = report.daily.map((row) => `
    <tr><td data-label="Date">${new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC" })}</td><td data-label="Cash in" class="money">${money(row.cashInCents)}</td><td data-label="Cash out" class="money">${money(row.cashOutCents)}</td><td data-label="Wagered" class="money">${money(row.wagered)}</td><td data-label="Won" class="money">${money(row.won)}</td><td data-label="Game net" class="money">${money(row.gameNet)}</td></tr>
  `).join("") || "<tr><td colspan='6'>No activity in this range.</td></tr>";

  document.getElementById("player-report-table").innerHTML = report.players.map((player) => `
    <tr><td data-label="Player"><b>${player.loginId}</b></td><td data-label="Status">${statusPill(player.status)}</td><td data-label="Cash in" class="money">${money(player.paidInCents)}</td><td data-label="Cash out" class="money">${money(player.paidOutCents)}</td><td data-label="Wagered" class="money">${money(player.wagered)}</td><td data-label="Won" class="money">${money(player.won)}</td><td data-label="Available" class="money">${money(player.totalCredits)}</td></tr>
  `).join("") || "<tr><td colspan='7'>No player activity yet.</td></tr>";

  document.getElementById("analytics-active-players").textContent = report.analytics.activePlayers;
  document.getElementById("analytics-active-note").textContent = `Last ${report.days} days`;
  document.getElementById("analytics-rounds").textContent = report.analytics.totalRounds.toLocaleString("en-US");
  document.getElementById("analytics-win-rounds").textContent = `${report.analytics.winningRounds.toLocaleString("en-US")} winning rounds`;
  document.getElementById("analytics-win-rate").textContent = percent(report.analytics.winRate);
  document.getElementById("analytics-return").textContent = percent(report.analytics.returnRate);
  document.getElementById("analytics-return-money").textContent = `${money(report.analytics.won)} won from ${money(report.analytics.wagered)}`;
  document.getElementById("player-analytics-title").textContent = `Last ${report.days} days`;

  const activityRows = report.daily.filter((row) => row.rounds > 0).slice(0, 14).reverse();
  const activityMax = Math.max(1, ...activityRows.flatMap((row) => [row.wagered, row.won]));
  document.getElementById("player-activity-chart").innerHTML = activityRows.map((row) => `
    <div class="activity-day" title="${money(row.wagered)} wagered · ${money(row.won)} won">
      <div class="activity-bars"><i class="wager" style="height:${row.wagered ? Math.max(3, row.wagered / activityMax * 100) : 0}%"></i><i class="win" style="height:${row.won ? Math.max(3, row.won / activityMax * 100) : 0}%"></i></div>
      <b>${new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</b>
      <small>${row.activePlayers} active · ${row.rounds} rounds</small>
    </div>
  `).join("") || "<p class='chart-empty'>No player activity in this range yet.</p>";

  const rankedPlayers = report.playerAnalytics.filter((player) =>
    player.rounds || (player.status !== "deleted" && (player.cashInCents || player.cashOutCents))
  );
  document.getElementById("player-analytics-table").innerHTML = rankedPlayers.map((player, index) => `
    <tr><td data-label="Player"><div class="ranked-player"><span>${index + 1}</span><div><b>${player.loginId}</b><small>Last played ${date(player.lastPlayedAt)}</small></div></div></td><td data-label="Status">${statusPill(player.status)}</td><td data-label="Cash in" class="money">${money(player.cashInCents)}</td><td data-label="Cash out" class="money">${money(player.cashOutCents)}</td><td data-label="Wagered" class="money">${money(player.wagered)}</td><td data-label="Won" class="money">${money(player.won)}</td><td data-label="Game net" class="money">${money(player.gameNet)}</td><td data-label="Rounds">${player.rounds.toLocaleString("en-US")}</td><td data-label="Win rate">${percent(player.winRate)}</td><td data-label="Return">${percent(player.returnRate)}</td></tr>
  `).join("") || "<tr><td colspan='10'>No player activity in this range.</td></tr>";
};

const chatPanel = document.getElementById("admin-chat-panel");
const chatBackdrop = document.getElementById("admin-chat-backdrop");
const chatPlayer = document.getElementById("admin-chat-player");
const chatMessages = document.getElementById("admin-chat-messages");
const chatBadge = document.getElementById("admin-chat-badge");

const renderChat = (messages) => {
  chatMessages.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "admin-chat-empty";
    empty.textContent = "No messages yet. Start the conversation.";
    chatMessages.append(empty);
    return;
  }
  for (const message of messages) {
    const row = document.createElement("div");
    const content = document.createElement("div");
    const bubble = document.createElement("p");
    const stamp = document.createElement("time");
    row.className = `admin-chat-message ${message.senderRole === "admin" ? "admin" : "player"}`;
    bubble.textContent = message.body;
    stamp.textContent = time(message.createdAt);
    content.append(bubble, stamp);
    row.append(content);
    chatMessages.append(row);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

const loadAdminChat = async () => {
  if (!chatPlayer.value) return renderChat([]);
  const data = await request(`/api/messages?playerId=${encodeURIComponent(chatPlayer.value)}`);
  renderChat(data.messages);
};

const refreshChatInbox = async () => {
  const data = await request("/api/messages");
  const selected = chatPlayer.value;
  chatPlayer.replaceChildren(...data.conversations.map((conversation) =>
    new Option(`${conversation.loginId}${conversation.unreadCount ? ` · ${conversation.unreadCount} new` : ""}`, conversation.playerId)
  ));
  if (data.conversations.some((conversation) => conversation.playerId === selected)) chatPlayer.value = selected;
  const unread = data.conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  chatBadge.hidden = unread === 0;
};

const closeAdminChat = () => {
  chatPanel.hidden = true;
  chatBackdrop.hidden = true;
  clearInterval(chatTimer);
};

document.getElementById("admin-chat-toggle").addEventListener("click", async () => {
  chatPanel.hidden = false;
  chatBackdrop.hidden = false;
  try {
    await refreshChatInbox();
    await loadAdminChat();
    chatTimer = setInterval(() => loadAdminChat().catch(() => {}), 8000);
  } catch (error) { setNotice(error.message, true); }
});
document.getElementById("admin-chat-close").addEventListener("click", closeAdminChat);
chatBackdrop.addEventListener("click", closeAdminChat);
chatPlayer.addEventListener("change", () => loadAdminChat().catch((error) => setNotice(error.message, true)));
document.getElementById("admin-chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("admin-chat-input");
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/messages", { method: "POST", body: JSON.stringify({ playerId: chatPlayer.value, message: input.value }) });
    input.value = "";
    await loadAdminChat();
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
});

const refresh = async () => {
  const days = Number(document.getElementById("report-range").value);
  const [playerData, reportData] = await Promise.all([request("/api/admin/players"), request(`/api/admin/reports?days=${days}`)]);
  players = playerData.players;
  report = reportData;
  renderPlayers();
  renderReport();
  refreshChatInbox().catch(() => {});
};

const showDashboard = async (admin) => {
  if (admin.role !== "admin") throw new Error("This login does not have admin access");
  document.getElementById("admin-identity").textContent = admin.loginId;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  openTab(window.location.hash.slice(1), false);
  await refresh();
};

document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("admin-login-error");
  const button = event.currentTarget.querySelector("button");
  error.textContent = "";
  button.disabled = true;
  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ loginId: document.getElementById("admin-login-id").value, pin: document.getElementById("admin-login-pin").value }),
    });
    await showDashboard(data.player);
  } catch (failure) { error.textContent = failure.message; }
  finally { button.disabled = false; }
});

document.getElementById("create-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "create", loginId: document.getElementById("new-login-id").value, pin: document.getElementById("new-login-pin").value }) });
    event.currentTarget.reset();
    setNotice("Player account created.");
    await refresh();
  } catch (error) { setNotice(error.message, true); }
});

document.getElementById("credit-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/players", {
      method: "POST",
      body: JSON.stringify({
        action: "credit",
        playerId: document.getElementById("credit-player-id").value,
        amountCents: dollarsToCents(document.getElementById("credit-amount").value),
        balanceType: document.getElementById("credit-balance").value,
        reason: document.getElementById("credit-reason").value,
      }),
    });
    setNotice("Money added successfully.");
    document.getElementById("credit-amount").value = "";
    await refresh();
  } catch (error) { setNotice(error.message, true); }
});

document.getElementById("cashout-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/players", {
      method: "POST",
      body: JSON.stringify({
        action: "cashout",
        playerId: document.getElementById("cashout-player-id").value,
        amountCents: dollarsToCents(document.getElementById("cashout-amount").value),
        reason: document.getElementById("cashout-reason").value,
      }),
    });
    setNotice("Cash-out record saved.");
    document.getElementById("cashout-amount").value = "";
    await refresh();
  } catch (error) { setNotice(error.message, true); }
});

document.getElementById("players-table").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const player = players.find((candidate) => candidate.id === button.dataset.id);
  if (!player) return;
  try {
    if (button.dataset.action === "pin") {
      const pin = window.prompt(`New 4-8 digit PIN for ${player.loginId}:`);
      if (!pin) return;
      await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "reset_pin", playerId: player.id, pin }) });
      setNotice(`PIN reset for ${player.loginId}.`);
    }
    if (button.dataset.action === "status") {
      const status = player.status === "active" ? "suspended" : "active";
      await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "status", playerId: player.id, status }) });
      setNotice(`${player.loginId} is now ${status === "suspended" ? "frozen" : "active"}.`);
    }
    if (button.dataset.action === "reset") {
      if (!window.confirm(`Reset ${player.loginId}'s test balance to $0.00? The adjustment remains in the ledger.`)) return;
      await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "reset_balance", playerId: player.id }) });
      setNotice(`${player.loginId}'s test balance was reset.`);
    }
    if (button.dataset.action === "delete") {
      if (!window.confirm(`Delete ${player.loginId}? Login access will end, but lifetime reporting will be retained.`)) return;
      await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "delete", playerId: player.id }) });
      setNotice(`${player.loginId} was deleted.`);
    }
    await refresh();
  } catch (error) { setNotice(error.message, true); }
});

document.getElementById("player-search").addEventListener("input", renderPlayers);
document.getElementById("hard-reset-all").addEventListener("click", async (event) => {
  const preserved = players.filter((player) => player.role === "player");
  if (!window.confirm(`TESTING ONLY\n\nDelete every payment, ledger entry, game round, and chat message, and reset all balances to $0.00?\n\nAll ${preserved.length} current and archived account IDs and PINs will remain.`)) return;
  const phrase = window.prompt('Type DELETE ALL TRANSACTIONS to permanently continue:');
  if (phrase !== "DELETE ALL TRANSACTIONS") {
    setNotice("Hard reset cancelled. Confirmation phrase did not match.", true);
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await request("/api/admin/players", {
      method: "POST",
      body: JSON.stringify({
        action: "hard_reset_all",
        confirmation: phrase,
      }),
    });
    const deleted = Object.values(result.deleted).reduce((sum, count) => sum + count, 0);
    setNotice(`Hard reset complete. ${deleted} activity records deleted; ${result.preservedAccounts.length} accounts preserved.`);
    await refresh();
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
});
document.getElementById("report-range").addEventListener("change", async (event) => {
  const days = Number(event.target.value);
  document.getElementById("analytics-range").value = String(days);
  document.getElementById("download-pdf").href = `/api/admin/report-pdf?days=${days}`;
  try { await refresh(); } catch (error) { setNotice(error.message, true); }
});
document.getElementById("analytics-range").addEventListener("change", async (event) => {
  const days = Number(event.target.value);
  document.getElementById("report-range").value = String(days);
  document.getElementById("download-pdf").href = `/api/admin/report-pdf?days=${days}`;
  try { await refresh(); } catch (error) { setNotice(error.message, true); }
});
document.getElementById("refresh-admin").addEventListener("click", () => refresh().then(() => setNotice("Dashboard refreshed.")).catch((error) => setNotice(error.message, true)));
document.getElementById("admin-logout").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  window.location.reload();
});

const installButton = document.getElementById("install-admin");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin", updateViaCache: "none" }).catch(() => {});
  });
}

request("/api/auth/me").then(({ player }) => showDashboard(player)).catch(() => {});
