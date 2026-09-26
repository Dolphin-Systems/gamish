const loginPanel = document.getElementById("admin-login");
const dashboard = document.getElementById("admin-dashboard");
const notice = document.getElementById("admin-notice");
let players = [];

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
const number = (value) => Number(value || 0).toLocaleString("en-US");

const setNotice = (message, error = false) => {
  notice.textContent = message;
  notice.style.color = error ? "#ff9d95" : "#9ee6b6";
};

const renderPlayers = () => {
  const tbody = document.getElementById("players-table");
  const select = document.getElementById("credit-player-id");
  tbody.replaceChildren();
  select.replaceChildren();
  players.filter((player) => player.role === "player").forEach((player) => {
    const option = new Option(player.loginId, player.id);
    select.add(option);
    const row = document.createElement("tr");
    row.innerHTML = `<td></td><td></td><td></td><td></td><td></td><td></td>`;
    const cells = row.children;
    cells[0].textContent = player.loginId;
    cells[1].textContent = player.status;
    cells[2].textContent = number(player.regularCredits);
    cells[3].textContent = number(player.bonusCredits);
    cells[4].textContent = number(player.totalCredits);
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.textContent = "Reset PIN";
    pinButton.addEventListener("click", () => resetPin(player));
    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = player.status === "active" ? "danger" : "";
    statusButton.textContent = player.status === "active" ? "Suspend" : "Activate";
    statusButton.addEventListener("click", () => setStatus(player));
    cells[5].append(pinButton, statusButton);
    tbody.append(row);
  });
};

const renderReports = (report) => {
  const today = report.daily[0] || {};
  document.getElementById("today-cash-in").textContent = money(today.cashInCents);
  document.getElementById("today-cash-out").textContent = money(today.cashOutCents);
  document.getElementById("today-game-net").textContent = number(today.gameNet);
  document.getElementById("bonus-pool").textContent = number(report.bonusPool.available);
  document.getElementById("game-model-note").textContent = `Fixed virtual-credit model: ${(report.gameModel.theoreticalHitRate * 100).toFixed(0)}% theoretical hit rate, ${(report.gameModel.theoreticalRtp * 100).toFixed(0)}% theoretical return. ${report.gameModel.note}`;

  document.getElementById("daily-table").innerHTML = report.daily.map((row) => `
    <tr><td>${new Date(row.date).toLocaleDateString()}</td><td>${money(row.cashInCents)}</td><td>${money(row.cashOutCents)}</td><td>${number(row.wagered)}</td><td>${number(row.won)}</td><td>${number(row.gameNet)}</td></tr>
  `).join("") || "<tr><td colspan='6'>No activity yet.</td></tr>";

  document.getElementById("player-report-table").innerHTML = report.players.map((row) => `
    <tr><td>${row.loginId}</td><td>${money(row.paidInCents)}</td><td>${number(row.wagered)}</td><td>${number(row.won)}</td><td>${number(row.bonusReceived)}</td><td>${number(row.regularCredits + row.bonusCredits)}</td></tr>
  `).join("") || "<tr><td colspan='6'>No players yet.</td></tr>";
};

const refresh = async () => {
  const [playerData, report] = await Promise.all([request("/api/admin/players"), request("/api/admin/reports")]);
  players = playerData.players;
  renderPlayers();
  renderReports(report);
};

const showDashboard = async (admin) => {
  if (admin.role !== "admin") throw new Error("This login does not have admin access");
  document.getElementById("admin-identity").textContent = admin.loginId;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await refresh();
};

document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("admin-login-error");
  error.textContent = "";
  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ loginId: document.getElementById("admin-login-id").value, pin: document.getElementById("admin-login-pin").value }),
    });
    await showDashboard(data.player);
  } catch (failure) {
    error.textContent = failure.message;
  }
});

document.getElementById("create-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/players", {
      method: "POST",
      body: JSON.stringify({ action: "create", loginId: document.getElementById("new-login-id").value, pin: document.getElementById("new-login-pin").value }),
    });
    event.currentTarget.reset();
    setNotice("Player login created.");
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
        amount: Number(document.getElementById("credit-amount").value),
        balanceType: document.getElementById("credit-balance").value,
        reason: document.getElementById("credit-reason").value,
      }),
    });
    setNotice("Credits sent.");
    document.getElementById("credit-amount").value = "";
    await refresh();
  } catch (error) { setNotice(error.message, true); }
});

async function resetPin(player) {
  const pin = window.prompt(`New 4–8 digit PIN for ${player.loginId}:`);
  if (!pin) return;
  try {
    await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "reset_pin", playerId: player.id, pin }) });
    setNotice(`PIN reset for ${player.loginId}. Existing sessions were signed out.`);
  } catch (error) { setNotice(error.message, true); }
}

async function setStatus(player) {
  const status = player.status === "active" ? "suspended" : "active";
  try {
    await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "status", playerId: player.id, status }) });
    setNotice(`${player.loginId} is now ${status}.`);
    await refresh();
  } catch (error) { setNotice(error.message, true); }
}

document.getElementById("refresh-admin").addEventListener("click", () => refresh().catch((error) => setNotice(error.message, true)));
document.getElementById("admin-logout").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  window.location.reload();
});

request("/api/auth/me").then(({ player }) => showDashboard(player)).catch(() => {});
