const loginPanel = document.getElementById("admin-login");
const dashboard = document.getElementById("admin-dashboard");
const notice = document.getElementById("admin-notice");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
let players = [];
let report = null;
let noticeTimer;

const pageCopy = {
  overview: ["Overview", "A quick look at today."],
  players: ["Players", "Create, freeze, reset, or delete player accounts."],
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
  const rows = players.filter((player) => player.role === "player" && player.loginId.toLowerCase().includes(query));
  document.getElementById("players-table").innerHTML = rows.map((player) => `
    <tr>
      <td><div class="player-name"><span class="avatar">${player.loginId[0].toUpperCase()}</span><div><b>${player.loginId}</b><small>Created ${date(player.createdAt)}</small></div></div></td>
      <td>${statusPill(player.status)}</td>
      <td class="money">${money(player.totalCredits)}</td>
      <td class="money">${money(player.lifetimeCashInCents)}</td>
      <td class="money">${money(player.lifetimeCashOutCents)}</td>
      <td>${playerActions(player)}</td>
    </tr>
  `).join("") || "<tr><td colspan='6'>No matching players.</td></tr>";

  const activePlayers = players.filter((player) => player.role === "player" && player.status !== "deleted");
  for (const select of [document.getElementById("credit-player-id"), document.getElementById("cashout-player-id")]) {
    const selected = select.value;
    select.replaceChildren(...activePlayers.map((player) => new Option(`${player.loginId} · ${money(player.totalCredits)}`, player.id)));
    if (activePlayers.some((player) => player.id === selected)) select.value = selected;
  }

  document.getElementById("cashflow-table").innerHTML = rows.map((player) => `
    <tr><td><b>${player.loginId}</b></td><td class="money">${money(player.totalCredits)}</td><td class="money">${money(player.lifetimeCashInCents)}</td><td class="money">${money(player.lifetimeCashOutCents)}</td><td class="money">${money(player.lifetimeCashInCents - player.lifetimeCashOutCents)}</td></tr>
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
    <tr><td>${new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC" })}</td><td class="money">${money(row.cashInCents)}</td><td class="money">${money(row.cashOutCents)}</td><td class="money">${money(row.wagered)}</td><td class="money">${money(row.won)}</td><td class="money">${money(row.gameNet)}</td></tr>
  `).join("") || "<tr><td colspan='6'>No activity in this range.</td></tr>";

  document.getElementById("player-report-table").innerHTML = report.players.map((player) => `
    <tr><td><b>${player.loginId}</b></td><td>${statusPill(player.status)}</td><td class="money">${money(player.paidInCents)}</td><td class="money">${money(player.paidOutCents)}</td><td class="money">${money(player.wagered)}</td><td class="money">${money(player.won)}</td><td class="money">${money(player.totalCredits)}</td></tr>
  `).join("") || "<tr><td colspan='7'>No player activity yet.</td></tr>";
};

const refresh = async () => {
  const days = Number(document.getElementById("report-range").value);
  const [playerData, reportData] = await Promise.all([request("/api/admin/players"), request(`/api/admin/reports?days=${days}`)]);
  players = playerData.players;
  report = reportData;
  renderPlayers();
  renderReport();
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
document.getElementById("report-range").addEventListener("change", async (event) => {
  const days = Number(event.target.value);
  document.getElementById("download-pdf").href = `/api/admin/report-pdf?days=${days}`;
  try { await refresh(); } catch (error) { setNotice(error.message, true); }
});
document.getElementById("refresh-admin").addEventListener("click", () => refresh().then(() => setNotice("Dashboard refreshed.")).catch((error) => setNotice(error.message, true)));
document.getElementById("admin-logout").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  window.location.reload();
});

request("/api/auth/me").then(({ player }) => showDashboard(player)).catch(() => {});
