const loginPanel = document.getElementById("admin-login");
const dashboard = document.getElementById("admin-dashboard");
const notice = document.getElementById("admin-notice");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const chatImages = window.GamishChatImages;
let players = [];
let report = null;
let noticeTimer;
let installPrompt;
let chatTimer;

const pageCopy = {
  overview: ["Overview", "What needs you now, and how the business is doing."],
  players: ["Players", "Create, freeze, reset, or delete player accounts."],
  analytics: ["Player analytics", "Understand player activity and game performance."],
  money: ["Money", "Confirm deposits, send cash-outs, and adjust balances."],
  reports: ["Reports", "Review activity and download a PDF."],
  games: ["Games", "Every lobby game: logo, name, ID, order, and whether it's on."],
  nerd: ["Nerd", "Game math, RTP and the house bank."],
  "api-flow": ["API Flow", "Trace player payment requests through processing and wallet updates."],
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
const inboxTime = (value) => {
  if (!value) return "";
  const stamp = new Date(value);
  const today = new Date();
  return stamp.toDateString() === today.toDateString()
    ? stamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : stamp.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const setNotice = (message, error = false) => {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.classList.toggle("error", error);
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4200);
};

const openTab = (name, updateHash = true) => {
  const tab = pageCopy[name] ? name : "overview";
  if (tab === "nerd") loadNerd();
  if (tab === "games") loadGames();
  if (tab === "api-flow") loadApiFlow().catch((error) => setNotice(error.message, true));
  document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  [pageTitle.textContent, pageDescription.textContent] = pageCopy[tab];
  if (updateHash && window.location.hash !== `#${tab}`) history.pushState(null, "", `#${tab}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.querySelectorAll("[data-tab], [data-open-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.tab || button.dataset.openTab)));
window.addEventListener("hashchange", () => openTab(window.location.hash.slice(1), false));

const statusPill = (status) => `<span class="status-pill ${status}">${status === "suspended" ? "Frozen" : status}</span>`;

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
  document.getElementById("archived-accounts").hidden = archived.length === 0;
  document.getElementById("players-table").innerHTML = rows.map((player) => `
    <tr>
      <td data-label="Player"><button class="player-name player-link" type="button" data-player-details="${player.id}"><span class="avatar">${player.loginId[0].toUpperCase()}</span><div><b>${escapeHtml(player.loginId)}</b><small>Last login ${date(player.lastLoginAt)}</small></div></button></td>
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
};

// Percentage change against the previous equal-length period, phrased for a quick read.
const delta = (node, current, previous, { invert = false } = {}) => {
  node.classList.remove("up", "down", "neutral");
  if (!previous && !current) { node.textContent = "No activity yet"; node.classList.add("neutral"); return; }
  if (!previous) { node.textContent = "New this period"; node.classList.add("neutral"); return; }
  const change = (current - previous) / Math.abs(previous);
  const good = invert ? change < 0 : change > 0;
  node.textContent = `${change >= 0 ? "▲" : "▼"} ${Math.abs(change * 100).toFixed(0)}% vs prior ${report.days}d`;
  node.classList.add(Math.abs(change) < 0.005 ? "neutral" : good ? "up" : "down");
};

const ACTIVITY_LABELS = {
  payment_credit: ["Deposit", "in"],
  admin_credit: ["Admin funding", "in"],
  bonus_credit: ["Bonus", "bonus"],
  withdrawal: ["Cash out", "out"],
  adjustment: ["Balance reset", "neutral"],
  big_win: ["Big win", "win"],
};

const renderOverview = () => {
  const { current, previous, today, liability, attention } = report;
  document.getElementById("att-deposits").textContent = attention.pendingDeposits;
  document.getElementById("att-deposits-sum").textContent = `${money(attention.pendingDepositCents)} waiting`;
  document.getElementById("att-cashouts").textContent = attention.pendingCashouts;
  document.getElementById("att-cashouts-sum").textContent = `${money(attention.pendingCashoutCents)} requested`;
  document.getElementById("att-unread").textContent = attention.unreadMessages;
  document.getElementById("att-unread-note").textContent = attention.unreadMessages
    ? `from ${attention.unreadConversations} player${attention.unreadConversations === 1 ? "" : "s"}`
    : "All caught up";
  document.querySelector('[data-attention="deposits"]').classList.toggle("hot", attention.pendingDeposits > 0);
  document.querySelector('[data-attention="cashouts"]').classList.toggle("hot", attention.pendingCashouts > 0);
  document.querySelector('[data-attention="chat"]').classList.toggle("hot", attention.unreadMessages > 0);
  document.getElementById("today-net").textContent = money(today.netCashCents);
  document.getElementById("today-note").textContent = `${money(today.cashInCents)} in · ${money(today.cashOutCents)} out · ${today.activePlayers} playing`;

  document.getElementById("kpi-net").textContent = money(current.netCashCents);
  delta(document.getElementById("kpi-net-delta"), current.netCashCents, previous.netCashCents);
  document.getElementById("kpi-in").textContent = money(current.cashInCents);
  delta(document.getElementById("kpi-in-delta"), current.cashInCents, previous.cashInCents);
  document.getElementById("kpi-out").textContent = money(current.cashOutCents);
  delta(document.getElementById("kpi-out-delta"), current.cashOutCents, previous.cashOutCents, { invert: true });
  document.getElementById("kpi-liability").textContent = money(liability.cashableCents);
  const liabilityNote = document.getElementById("kpi-liability-note");
  liabilityNote.textContent = `+ ${money(liability.bonusCents)} bonus`;
  document.getElementById("kpi-game").textContent = money(current.gameNet);
  delta(document.getElementById("kpi-game-delta"), current.gameNet, previous.gameNet);
  document.getElementById("kpi-players").textContent = current.activePlayers;
  delta(document.getElementById("kpi-players-delta"), current.activePlayers, previous.activePlayers);
  document.getElementById("kpi-players-note").textContent = `${current.rounds.toLocaleString("en-US")} rounds · ${report.summary.activePlayers} accounts`;

  // A continuous run of days (empty ones included) so the shape of the period is visible.
  const byDate = new Map(report.daily.map((row) => [String(row.date).slice(0, 10), row]));
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: report.timezone });
  const empty = { cashInCents: 0, cashOutCents: 0, cashNetCents: 0 };
  const days = Array.from({ length: Math.min(report.days, 14) }, (_, index) => {
    const key = dayKey.format(new Date(Date.now() - (Math.min(report.days, 14) - 1 - index) * 86_400_000));
    return { ...empty, ...byDate.get(key), date: `${key}T00:00:00Z` };
  });
  const peak = Math.max(1, ...days.flatMap((row) => [row.cashInCents, row.cashOutCents]));
  const chart = document.getElementById("cashflow-chart");
  chart.style.setProperty("--days", days.length);
  chart.innerHTML = days.map((row, index) => `
    <div class="activity-day${index % 2 ? " alt" : ""}" title="${money(row.cashInCents)} in · ${money(row.cashOutCents)} out">
      <div class="activity-bars"><i class="cash-in" style="height:${row.cashInCents ? Math.max(3, row.cashInCents / peak * 100) : 0}%"></i><i class="cash-out" style="height:${row.cashOutCents ? Math.max(3, row.cashOutCents / peak * 100) : 0}%"></i></div>
      <b>${new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</b>
      <small class="${row.cashNetCents < 0 ? "negative" : row.cashNetCents ? "" : "quiet"}">${row.cashNetCents ? `${row.cashNetCents > 0 ? "+" : "−"}${money(Math.abs(row.cashNetCents))}` : "—"}</small>
    </div>
  `).join("") || "<p class='chart-empty'>No money movement in this range yet.</p>";

  document.getElementById("activity-feed").innerHTML = report.activity.map((item) => {
    const [label, tone] = ACTIVITY_LABELS[item.type] || [item.type, "neutral"];
    const sign = tone === "out" ? "−" : tone === "neutral" ? "" : "+";
    return `
      <li class="activity-item ${tone}">
        <span class="activity-dot"></span>
        <div><b>${label} · <button class="inline-link" type="button" data-player-name="${escapeHtml(item.loginId)}">${escapeHtml(item.loginId)}</button></b><small>${escapeHtml(item.note)} · ${inboxTime(item.createdAt)}</small></div>
        <strong>${sign}${money(item.amountCents)}</strong>
      </li>`;
  }).join("") || "<li class='activity-empty'>Deposits, cash-outs and big wins will appear here.</li>";
};

const renderReport = () => {
  if (!report) return;
  renderOverview();
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
    <tr><td data-label="Player"><button class="ranked-player player-link" type="button" data-player-details="${player.id}"><span>${index + 1}</span><div><b>${escapeHtml(player.loginId)}</b><small>Last played ${date(player.lastPlayedAt)}</small></div></button></td><td data-label="Status">${statusPill(player.status)}</td><td data-label="Cash in" class="money">${money(player.cashInCents)}</td><td data-label="Cash out" class="money">${money(player.cashOutCents)}</td><td data-label="Wagered" class="money">${money(player.wagered)}</td><td data-label="Won" class="money">${money(player.won)}</td><td data-label="Game net" class="money">${money(player.gameNet)}</td><td data-label="Rounds">${player.rounds.toLocaleString("en-US")}</td><td data-label="Win rate">${percent(player.winRate)}</td><td data-label="Return">${percent(player.returnRate)}</td></tr>
  `).join("") || "<tr><td colspan='10'>No player activity in this range.</td></tr>";
};

const chatPanel = document.getElementById("admin-chat-panel");
const chatBackdrop = document.getElementById("admin-chat-backdrop");
const chatList = document.getElementById("admin-chat-list");
const chatSearch = document.getElementById("admin-chat-search");
const chatMessages = document.getElementById("admin-chat-messages");
const chatBadge = document.getElementById("admin-chat-badge");
const chatInput = document.getElementById("admin-chat-input");
const chatForm = document.getElementById("admin-chat-form");
const chatPlayerName = document.getElementById("admin-chat-player-name");
const chatPlayerStatus = document.getElementById("admin-chat-player-status");
const chatAvatar = document.getElementById("admin-chat-avatar");
const chatContext = document.getElementById("admin-chat-context");
const chatCanned = document.getElementById("admin-chat-canned");
const chatProfile = document.getElementById("admin-chat-profile");
const chatImageInput = document.getElementById("admin-chat-image-input");
const chatImagePreview = document.getElementById("admin-chat-image-preview");
const chatImagePreviewPhoto = document.getElementById("admin-chat-image-preview-photo");
const chatImagePreviewName = document.getElementById("admin-chat-image-preview-name");
const chatAttach = document.getElementById("admin-chat-attach");
let chatConversations = [];
let selectedChatPlayerId = "";
let pendingAdminImage = null;
let chatFilter = "all";
let threadMessages = [];
let threadPlayerId = "";
let threadSeenUntil = null;
let summaryTimer;
chatImages?.setupViewer();

const setPendingAdminImage = (attachment) => {
  pendingAdminImage = attachment;
  chatImagePreview.hidden = !attachment;
  if (attachment) {
    chatImagePreviewPhoto.src = attachment.previewUrl;
    chatImagePreviewName.textContent = attachment.name;
  } else {
    chatImagePreviewPhoto.removeAttribute("src");
    chatImageInput.value = "";
  }
};

const selectedConversation = () => chatConversations.find((conversation) => conversation.playerId === selectedChatPlayerId);

const setChatBadge = (unread) => {
  chatBadge.hidden = !unread;
  chatBadge.textContent = unread > 9 ? "9+" : unread ? String(unread) : "";
};

const setChatThread = (conversation) => {
  const enabled = Boolean(conversation);
  chatPlayerName.textContent = conversation?.loginId || "Choose a player";
  chatPlayerStatus.textContent = conversation
    ? `${conversation.status === "suspended" ? "Frozen" : "Active"} · last login ${conversation.lastLoginAt ? inboxTime(conversation.lastLoginAt) : "never"}`
    : "Choose anyone from the inbox";
  chatAvatar.textContent = conversation?.loginId?.charAt(0).toUpperCase() || "?";
  chatInput.disabled = !enabled;
  chatImageInput.disabled = !enabled;
  chatAttach.disabled = !enabled;
  chatCanned.hidden = !enabled;
  chatProfile.hidden = !enabled;
  chatForm.querySelector('button[type="submit"]').disabled = !enabled;
  // Context an admin needs mid-conversation: balance and anything waiting on them.
  chatContext.hidden = !enabled;
  if (enabled) {
    const waiting = adminRequests.filter((item) => item.playerId === conversation.playerId && item.status === "pending");
    chatContext.innerHTML = `
      <span><small>Balance</small><b>${money(conversation.totalCredits)}</b></span>
      ${waiting.map((item) => `<button class="context-request ${item.kind}" type="button" data-open-request="${item.id}">${item.kind === "deposit" ? "↓ Deposit" : "↑ Cash out"} ${money(item.amountCents)} · ${escapeHtml(item.methodName)}</button>`).join("")}
      ${waiting.length ? "" : "<span class='context-quiet'>No pending requests</span>"}`;
  }
};

const renderChatInbox = () => {
  const query = chatSearch.value.trim().toLowerCase();
  const conversations = chatConversations.filter((conversation) =>
    conversation.loginId.toLowerCase().includes(query)
    && (chatFilter !== "unread" || conversation.unreadCount > 0)
    && (chatFilter !== "requests" || conversation.pendingRequests > 0));
  chatList.replaceChildren();
  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "chat-inbox-empty";
    empty.textContent = !chatConversations.length ? "No player accounts yet."
      : chatFilter === "unread" ? "No unread messages. Nice work." : chatFilter === "requests" ? "Nobody is waiting on a request." : "No players match that search.";
    chatList.append(empty);
    return;
  }
  for (const conversation of conversations) {
    const button = document.createElement("button");
    const avatar = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const preview = document.createElement("small");
    const meta = document.createElement("span");
    const stamp = document.createElement("time");
    button.type = "button";
    button.className = `chat-inbox-item${conversation.playerId === selectedChatPlayerId ? " active" : ""}${conversation.unreadCount ? " unread" : ""}`;
    button.dataset.playerId = conversation.playerId;
    button.setAttribute("role", "listitem");
    avatar.className = `chat-inbox-avatar${conversation.status === "suspended" ? " suspended" : ""}`;
    avatar.textContent = conversation.loginId.charAt(0).toUpperCase();
    copy.className = "chat-inbox-copy";
    name.textContent = conversation.loginId;
    if (conversation.pendingRequests) {
      const flag = document.createElement("i");
      flag.className = "request-flag";
      flag.textContent = `${conversation.pendingRequests} request${conversation.pendingRequests === 1 ? "" : "s"}`;
      name.append(flag);
    }
    preview.textContent = conversation.lastMessage
      ? `${conversation.lastFromPlayer ? "" : "You: "}${conversation.lastMessage}`
      : "Start a conversation";
    meta.className = "chat-inbox-meta";
    stamp.textContent = inboxTime(conversation.lastMessageAt);
    meta.append(stamp);
    if (conversation.unreadCount) {
      const unread = document.createElement("b");
      unread.textContent = conversation.unreadCount > 99 ? "99+" : String(conversation.unreadCount);
      meta.append(unread);
    }
    copy.append(name, preview);
    button.append(avatar, copy, meta);
    chatList.append(button);
  }
};

const renderChat = () => {
  const nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 80;
  chatMessages.replaceChildren();
  if (!threadMessages.length) {
    const empty = document.createElement("p");
    empty.className = "admin-chat-empty";
    empty.textContent = selectedChatPlayerId ? "No messages yet. Start the conversation." : "Pick a conversation to read it here.";
    chatMessages.append(empty);
    return;
  }
  const seenTime = threadSeenUntil ? new Date(threadSeenUntil).getTime() : 0;
  const lastAdmin = [...threadMessages].reverse().find((message) => message.senderRole === "admin");
  let lastDay = "";
  for (const message of threadMessages) {
    const day = new Date(message.createdAt).toDateString();
    if (day !== lastDay) {
      const divider = document.createElement("p");
      divider.className = "chat-day";
      divider.textContent = day === new Date().toDateString() ? "Today" : date(message.createdAt);
      chatMessages.append(divider);
      lastDay = day;
    }
    const row = document.createElement("div");
    const content = document.createElement("div");
    const bubble = document.createElement("div");
    const stamp = document.createElement("time");
    row.className = `admin-chat-message ${message.senderRole === "admin" ? "admin" : "player"}`;
    bubble.className = "admin-chat-bubble";
    if (message.attachment) {
      bubble.classList.add("has-image");
      bubble.append(chatImages.createMessageImage(message.attachment));
    }
    if (!message.attachment || message.body !== "Photo") {
      const caption = document.createElement("p");
      caption.className = "chat-photo-caption";
      caption.textContent = message.body;
      bubble.append(caption);
    }
    stamp.textContent = new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      + (message === lastAdmin ? (new Date(message.createdAt).getTime() <= seenTime ? " · Seen" : " · Sent") : "");
    content.append(bubble, stamp);
    row.append(content);
    chatMessages.append(row);
  }
  if (nearBottom || threadPlayerId !== selectedChatPlayerId) chatMessages.scrollTop = chatMessages.scrollHeight;
};

const loadAdminChat = async () => {
  const conversation = selectedConversation();
  setChatThread(conversation);
  if (!conversation) {
    threadMessages = [];
    return renderChat();
  }
  // Same thread as before: fetch only what is new.
  const sameThread = threadPlayerId === selectedChatPlayerId && threadMessages.length;
  const newest = sameThread ? threadMessages.at(-1).createdAt : null;
  const data = await request(`/api/messages?playerId=${encodeURIComponent(selectedChatPlayerId)}${newest ? `&after=${encodeURIComponent(newest)}` : ""}`);
  threadMessages = sameThread ? [...threadMessages, ...data.messages.filter((m) => !threadMessages.some((known) => known.id === m.id))] : data.messages;
  threadSeenUntil = data.seenUntil;
  conversation.unreadCount = 0;
  conversation.status = data.player.status;
  setChatThread(conversation);
  renderChatInbox();
  renderChat();
  threadPlayerId = selectedChatPlayerId;
};

const refreshChatInbox = async () => {
  const data = await request("/api/messages");
  chatConversations = data.conversations;
  if (!chatConversations.some((conversation) => conversation.playerId === selectedChatPlayerId)) {
    selectedChatPlayerId = "";
  }
  renderChatInbox();
  setChatThread(selectedConversation());
  setChatBadge(chatConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0));
};

const pollAdminChat = async () => {
  await refreshChatInbox();
  await loadAdminChat();
};

// While chat is closed, a tiny unread count keeps the badge honest.
const pollChatSummary = async () => {
  clearTimeout(summaryTimer);
  if (!dashboard.hidden && chatPanel.hidden && document.visibilityState === "visible") {
    try { setChatBadge((await request("/api/messages?summary=1")).unreadCount); } catch { /* keep badge */ }
  }
  summaryTimer = setTimeout(pollChatSummary, 20_000);
};

const closeAdminChat = () => {
  chatPanel.hidden = true;
  chatBackdrop.hidden = true;
  chatPanel.classList.remove("conversation-open");
  setPendingAdminImage(null);
  clearInterval(chatTimer);
};

const openAdminChat = async (playerId) => {
  closeAdminPayment();
  closePlayerDrawer();
  chatPanel.hidden = false;
  chatBackdrop.hidden = false;
  try {
    await refreshChatInbox();
    if (playerId) {
      selectedChatPlayerId = playerId;
      chatPanel.classList.add("conversation-open");
      renderChatInbox();
    }
    await loadAdminChat();
    clearInterval(chatTimer);
    chatTimer = setInterval(() => pollAdminChat().catch(() => {}), 6000);
  } catch (error) { setNotice(error.message, true); }
};

document.getElementById("admin-chat-toggle").addEventListener("click", () => openAdminChat());
document.getElementById("admin-chat-close").addEventListener("click", closeAdminChat);
chatBackdrop.addEventListener("click", closeAdminChat);
chatSearch.addEventListener("input", renderChatInbox);
document.querySelectorAll("[data-chat-filter]").forEach((button) => button.addEventListener("click", () => {
  chatFilter = button.dataset.chatFilter;
  document.querySelectorAll("[data-chat-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderChatInbox();
}));
chatList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-player-id]");
  if (!button) return;
  if (selectedChatPlayerId !== button.dataset.playerId) setPendingAdminImage(null);
  selectedChatPlayerId = button.dataset.playerId;
  chatPanel.classList.add("conversation-open");
  renderChatInbox();
  try { await loadAdminChat(); }
  catch (error) { setNotice(error.message, true); }
});
document.getElementById("admin-chat-back").addEventListener("click", () => {
  chatPanel.classList.remove("conversation-open");
  setPendingAdminImage(null);
  chatSearch.focus();
});
chatProfile.addEventListener("click", () => openPlayerDrawer(selectedChatPlayerId));
chatContext.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-request]");
  if (!button) return;
  closeAdminChat();
  openRequest(button.dataset.openRequest);
});
chatCanned.addEventListener("click", (event) => {
  const button = event.target.closest("[data-canned]");
  if (!button) return;
  chatInput.value = button.dataset.canned;
  chatInput.focus();
});

const sendAdminMessage = async (message, attachment) => {
  await request("/api/messages", { method: "POST", body: JSON.stringify({ playerId: selectedChatPlayerId, message, attachment }) });
  await loadAdminChat();
  await refreshChatInbox();
};

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (!selectedChatPlayerId) return;
  button.disabled = true;
  try {
    const message = chatInput.value.trim();
    if (!message && !pendingAdminImage) return;
    const attachment = pendingAdminImage ? {
      data: pendingAdminImage.data,
      type: pendingAdminImage.type,
      name: pendingAdminImage.name,
    } : null;
    chatInput.value = "";
    setPendingAdminImage(null);
    await sendAdminMessage(message, attachment);
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = !selectedChatPlayerId; }
});
chatAttach.addEventListener("click", () => chatImageInput.click());
chatImageInput.addEventListener("change", async () => {
  const [file] = chatImageInput.files;
  if (!file) return;
  chatAttach.disabled = true;
  try {
    setNotice("Preparing image…");
    setPendingAdminImage(await chatImages.prepare(file));
    setNotice("Image ready to send.");
  } catch (error) {
    setPendingAdminImage(null);
    setNotice(error.message, true);
  } finally {
    chatAttach.disabled = !selectedChatPlayerId;
  }
});
document.getElementById("admin-chat-image-remove").addEventListener("click", () => setPendingAdminImage(null));

// ---------- Payment requests ----------

const requestList = document.getElementById("admin-requests");
let adminRequests = [];
let requestFilter = "pending";
const apiFlowList = document.getElementById("api-flow-list");
let apiFlowEvents = [];

const requestAge = (value) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return date(value);
};

const renderRequests = () => {
  const pending = adminRequests.filter((item) => item.status === "pending");
  document.getElementById("pending-request-count").textContent = pending.length;
  const badge = document.getElementById("money-badge");
  badge.hidden = !pending.length;
  badge.textContent = pending.length > 9 ? "9+" : String(pending.length);
  const rows = requestFilter === "pending" ? pending : adminRequests;
  requestList.innerHTML = rows.map((item) => {
    const deposit = item.kind === "deposit";
    const balance = item.playerBalance ? money(item.playerBalance.regularCredits) : "—";
    const decided = item.status !== "pending";
    return `
      <article class="admin-request ${item.kind} ${item.status}" id="request-${item.id}">
        <div class="request-who">
          <span class="request-kind">${deposit ? "↓" : "↑"}</span>
          <div>
            <b><button class="inline-link" type="button" data-player-details="${item.playerId}">${escapeHtml(item.loginId)}</button> · ${deposit ? "Deposit" : "Cash out"}</b>
            <small>${deposit ? `Says they sent to <em>${escapeHtml(item.paymentHandle)}</em> on ${escapeHtml(item.methodName)}` : `Send to <em>${escapeHtml(item.paymentHandle)}</em> on ${escapeHtml(item.methodName)}`} · ${requestAge(item.createdAt)}</small>
            ${item.note ? `<small class="request-player-note">“${escapeHtml(item.note)}”</small>` : ""}
          </div>
        </div>
        <div class="request-amount">
          <strong>${money(item.amountCents)}</strong>
          <small>${deposit ? (item.bonusCents && !decided ? `+ ${money(item.bonusCents)} bonus if pool allows` : "") : `Cashable balance ${balance}`}</small>
        </div>
        ${decided ? `
          <div class="request-outcome">
            <span class="status-pill ${item.status === "approved" ? "" : "deleted"}">${item.status === "approved" ? (deposit ? "Credited" : "Sent") : item.status}</span>
            <small>${item.status === "approved" && deposit ? `${money(item.creditedCents)}${item.bonusCents ? ` + ${money(item.bonusCents)} bonus` : ""} · ` : ""}${item.decidedAt ? requestAge(item.decidedAt) : ""}${item.adminNote ? ` · “${escapeHtml(item.adminNote)}”` : ""}</small>
          </div>` : `
          <div class="request-actions">
            ${deposit ? `<label class="received-field"><span>Received</span><input type="number" min="0.01" step="0.01" inputmode="decimal" value="${(item.amountCents / 100).toFixed(2)}" data-received="${item.id}" /></label>` : ""}
            <button class="button primary" type="button" data-request-action="approve" data-id="${item.id}">${deposit ? "Confirm & credit" : "Mark as sent"}</button>
            <button class="mini-button" type="button" data-request-action="chat" data-player="${item.playerId}">Message</button>
            <button class="mini-button danger" type="button" data-request-action="decline" data-id="${item.id}">Decline</button>
          </div>`}
      </article>`;
  }).join("") || `<p class="requests-empty">${requestFilter === "pending" ? "You're all caught up. New deposit and cash-out requests land here." : "No requests yet."}</p>`;
};

const loadRequests = async () => {
  const data = await request("/api/payment-methods?requests=1");
  adminRequests = data.requests;
  renderRequests();
};

const renderApiFlow = () => {
  const count = document.getElementById("api-flow-count");
  count.textContent = `${apiFlowEvents.length} events`;
  apiFlowList.innerHTML = apiFlowEvents.map((item) => {
    const completed = item.status === "approved" || item.status === "succeeded";
    const pending = item.status === "pending";
    const status = completed ? "Completed" : pending ? "Pending" : item.status.charAt(0).toUpperCase() + item.status.slice(1);
    const statusClass = completed ? "completed" : pending ? "pending" : "closed";
    const source = item.source === "processor_webhook" ? "Payment processor API"
      : item.source === "admin_completion" ? "Admin wallet update" : "Player API request";
    const direction = item.kind === "cashout" ? "Cash out" : "Deposit";
    const settled = item.completedAmountCents === null
      ? "Not settled"
      : `${item.kind === "cashout" ? "−" : "+"}${money(item.completedAmountCents)}`;
    const completion = item.completedAt
      ? `${completed ? "Completed" : "Reviewed"} ${time(item.completedAt)}`
      : "Awaiting review";
    const remark = item.adminNote ? `${item.remark || "—"} · Admin: ${item.adminNote}` : item.remark || "—";
    return `
      <article class="api-flow-item">
        <div class="api-flow-top">
          <div class="api-flow-identity">
            <span class="api-flow-status ${statusClass}">${escapeHtml(status)}</span>
            <div><strong>${escapeHtml(item.player)}</strong><small>${escapeHtml(source)} · ${escapeHtml(direction)} · ${time(item.submittedAt)}</small></div>
          </div>
          <strong class="api-flow-amount">${money(item.amountCents)}</strong>
        </div>
        <div class="api-flow-fields">
          <div><small>Payment ID</small><b>${escapeHtml(item.paymentId || "—")}</b></div>
          <div><small>Payment method</small><b>${escapeHtml(item.methodName || "—")}</b></div>
          <div><small>Remark</small><b>${escapeHtml(remark)}</b></div>
          <div><small>Wallet update</small><b>${escapeHtml(settled)}</b></div>
        </div>
        <div class="api-flow-footer"><span>Request ${escapeHtml(item.id.slice(0, 8))}</span><span>${escapeHtml(completion)}</span></div>
      </article>`;
  }).join("") || `<p class="api-flow-empty">No player requests or processor transactions yet.</p>`;
};

const loadApiFlow = async () => {
  const data = await request("/api/payment-methods?flow=1");
  apiFlowEvents = data.events;
  renderApiFlow();
};

document.getElementById("refresh-api-flow").addEventListener("click", () => {
  loadApiFlow().then(() => setNotice("Payment API log refreshed.")).catch((error) => setNotice(error.message, true));
});

const openRequest = (id) => {
  requestFilter = "pending";
  document.querySelectorAll("[data-request-filter]").forEach((button) => button.classList.toggle("active", button.dataset.requestFilter === "pending"));
  openTab("money");
  renderRequests();
  setTimeout(() => {
    const card = document.getElementById(`request-${id}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("flash");
  }, 120);
};

document.querySelectorAll("[data-request-filter]").forEach((button) => button.addEventListener("click", () => {
  requestFilter = button.dataset.requestFilter;
  document.querySelectorAll("[data-request-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderRequests();
}));

requestList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-request-action]");
  if (!button) return;
  const action = button.dataset.requestAction;
  if (action === "chat") return openAdminChat(button.dataset.player);
  const item = adminRequests.find((candidate) => candidate.id === button.dataset.id);
  if (!item) return;
  let body;
  if (action === "approve") {
    const received = item.kind === "deposit" ? requestList.querySelector(`[data-received="${item.id}"]`)?.value : null;
    const amountCents = received ? dollarsToCents(received) : item.amountCents;
    const prompt = item.kind === "deposit"
      ? `Credit ${money(amountCents)} to ${item.loginId}? Only confirm once the money is in your ${item.methodName} account.`
      : `Confirm you sent ${money(item.amountCents)} to ${item.paymentHandle} on ${item.methodName}? This debits ${item.loginId}'s balance.`;
    if (!window.confirm(prompt)) return;
    body = { action: "request_approve", id: item.id, amountCents: item.kind === "deposit" ? amountCents : undefined };
  } else {
    const note = window.prompt(`Reason for declining ${item.loginId}'s ${item.kind === "deposit" ? "deposit" : "cash out"} (shown to the player):`, item.kind === "deposit" ? "Payment not received" : "");
    if (note === null) return;
    body = { action: "request_decline", id: item.id, note };
  }
  button.disabled = true;
  try {
    await request("/api/payment-methods", { method: "POST", body: JSON.stringify(body) });
    setNotice(action === "approve" ? (item.kind === "deposit" ? `${item.loginId} credited.` : `Cash out to ${item.loginId} recorded.`) : "Request declined.");
    await refresh();
  } catch (error) {
    setNotice(error.message, true);
    button.disabled = false;
  }
});

document.querySelectorAll("[data-attention]").forEach((card) => card.addEventListener("click", () => {
  if (card.dataset.attention === "chat") return openAdminChat();
  const kind = card.dataset.attention === "deposits" ? "deposit" : "cashout";
  const first = adminRequests.find((item) => item.status === "pending" && item.kind === kind);
  if (first) openRequest(first.id);
  else openTab("money");
}));

// ---------- Player detail drawer ----------

const drawer = document.getElementById("player-drawer");
const drawerBackdrop = document.getElementById("player-drawer-backdrop");
const drawerBody = document.getElementById("player-drawer-body");
let drawerPlayerId = "";

const LEDGER_LABELS = { payment_credit: "Deposit", admin_credit: "Admin funding", bonus_credit: "Bonus", withdrawal: "Cash out", adjustment: "Balance reset" };

const closePlayerDrawer = () => {
  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  drawerPlayerId = "";
};

const openPlayerDrawer = async (playerId, { quiet = false } = {}) => {
  if (!playerId) return;
  if (!quiet) {
    closeAdminChat();
    closeAdminPayment();
    drawerBody.innerHTML = "<p class='helper'>Loading player…</p>";
  }
  drawerPlayerId = playerId;
  drawer.hidden = false;
  drawerBackdrop.hidden = false;
  try {
    const data = await request(`/api/admin/players?playerId=${encodeURIComponent(playerId)}`);
    if (drawerPlayerId !== playerId) return;
    const { player, stats, ledger, requests } = data;
    const summary = players.find((candidate) => candidate.id === playerId) || {};
    const cashIn = summary.lifetimeCashInCents || 0;
    const cashOut = summary.lifetimeCashOutCents || 0;
    document.getElementById("player-drawer-title").textContent = player.loginId;
    document.getElementById("player-drawer-avatar").textContent = player.loginId.charAt(0).toUpperCase();
    drawerBody.innerHTML = `
      <div class="drawer-status">${statusPill(player.status)}<small>Joined ${date(player.createdAt)} · last login ${player.lastLoginAt ? inboxTime(player.lastLoginAt) : "never"}</small></div>
      <div class="drawer-balance">
        <div><small>Cashable</small><strong>${money(player.regularCredits)}</strong></div>
        <div><small>Bonus</small><strong>${money(player.bonusCredits)}</strong></div>
      </div>
      <div class="drawer-stats">
        <div><small>Lifetime in</small><b>${money(cashIn)}</b></div>
        <div><small>Lifetime out</small><b>${money(cashOut)}</b></div>
        <div><small>Net from player</small><b class="${cashIn - cashOut < 0 ? "negative" : ""}">${money(cashIn - cashOut)}</b></div>
        <div><small>Rounds</small><b>${stats.rounds.toLocaleString("en-US")}</b></div>
        <div><small>Wagered / won</small><b>${money(stats.wagered)} / ${money(stats.won)}</b></div>
        <div><small>Last played</small><b>${stats.lastPlayedAt ? inboxTime(stats.lastPlayedAt) : "Never"}</b></div>
      </div>
      ${player.status === "deleted" ? "" : `
      <div class="drawer-actions">
        <button class="button primary" type="button" data-drawer-action="chat">Message</button>
        <button class="button dark" type="button" data-drawer-action="fund">Add money</button>
        <button class="mini-button" type="button" data-drawer-action="cashout">Record cash out</button>
      </div>`}
      <h3>Payment usernames</h3>
      <ul class="drawer-list">${Object.entries(player.payoutHandles || {}).map(([name, handle]) => `
        <li><span class="dot deposit"></span><div><b>${escapeHtml(name)}</b><small>Saved by the player</small></div><strong>${escapeHtml(handle)}</strong></li>`).join("") || "<li class='empty'>None saved yet.</li>"}</ul>
      <h3>Requests</h3>
      <ul class="drawer-list">${requests.map((item) => `
        <li><span class="dot ${item.kind}"></span><div><b>${item.kind === "deposit" ? "Deposit" : "Cash out"} · ${escapeHtml(item.methodName)}</b><small>${inboxTime(item.createdAt)} · ${{ pending: "Waiting on you", approved: item.kind === "deposit" ? "Credited" : "Sent", declined: "Declined", cancelled: "Cancelled by player" }[item.status]}</small></div><strong>${money(item.amountCents)}</strong></li>`).join("") || "<li class='empty'>No requests yet.</li>"}</ul>
      <h3>Money history</h3>
      <ul class="drawer-list">${ledger.map((entry) => `
        <li><span class="dot ${entry.amountCents < 0 ? "cashout" : "deposit"}"></span><div><b>${LEDGER_LABELS[entry.type] || entry.type}</b><small>${inboxTime(entry.createdAt)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</small></div><strong>${entry.amountCents < 0 ? "−" : "+"}${money(Math.abs(entry.amountCents))}</strong></li>`).join("") || "<li class='empty'>No deposits or cash-outs yet.</li>"}</ul>`;
  } catch (error) {
    drawerBody.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
};

drawerBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drawer-action]");
  if (!button) return;
  const playerId = drawerPlayerId;
  const action = button.dataset.drawerAction;
  if (action === "chat") return openAdminChat(playerId);
  closePlayerDrawer();
  openTab("money");
  const select = document.getElementById(action === "fund" ? "credit-player-id" : "cashout-player-id");
  select.value = playerId;
  const amount = document.getElementById(action === "fund" ? "credit-amount" : "cashout-amount");
  amount.closest("form").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => amount.focus(), 350);
});
document.getElementById("player-drawer-close").addEventListener("click", closePlayerDrawer);
drawerBackdrop.addEventListener("click", closePlayerDrawer);

// Any player name across the dashboard opens their details.
document.addEventListener("click", (event) => {
  const byId = event.target.closest("[data-player-details]");
  const byName = event.target.closest("[data-player-name]");
  if (!byId && !byName) return;
  const id = byId?.dataset.playerDetails || players.find((player) => player.loginId === byName.dataset.playerName)?.id;
  if (id) openPlayerDrawer(id);
});

const paymentPanel = document.getElementById("admin-payment-panel");
const paymentBackdrop = document.getElementById("admin-payment-backdrop");
const paymentMethodList = document.getElementById("admin-payment-methods");
let paymentMethods = [];

const renderPaymentMethods = () => {
  const groups = new Map();
  for (const method of paymentMethods) {
    const key = method.methodName.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: method.methodName, methods: [] });
    groups.get(key).methods.push(method);
  }
  if (!groups.size) {
    paymentMethodList.innerHTML = '<p class="payment-method-empty">No payment methods yet. Add a method and its first payment ID above.</p>';
    return;
  }
  paymentMethodList.innerHTML = [...groups.values()].map((group) => {
    const enabled = group.methods.filter((method) => method.enabled);
    const current = enabled.find((method) => method.isCurrent);
    return `
      <section class="payment-route-group">
        <div class="payment-route-heading">
          <div class="payment-route-name"><span class="payment-route-logo">${escapeHtml(group.name.charAt(0).toUpperCase())}</span><div><b>${escapeHtml(group.name)}</b><small>${current ? `Live · ${escapeHtml(current.paymentId)}` : "Not shown to players"}</small></div></div>
          ${enabled.length > 1 ? `<button class="mini-button" type="button" data-payment-action="rotate" data-method-name="${encodeURIComponent(group.name)}">Rotate</button>` : ""}
        </div>
        ${group.methods.map((method) => `
          <div class="payment-id-row">
            <div class="payment-id-copy"><strong>${escapeHtml(method.paymentId)}</strong><small class="${method.isCurrent && method.enabled ? "live" : method.enabled ? "" : "off"}">${method.isCurrent && method.enabled ? "LIVE NOW" : method.enabled ? "READY" : "DISABLED"}</small></div>
            <div class="payment-id-actions">
              ${method.enabled && !method.isCurrent ? `<button class="mini-button" type="button" data-payment-action="select" data-id="${method.id}">Use</button>` : ""}
              <button class="mini-button" type="button" data-payment-action="toggle" data-id="${method.id}">${method.enabled ? "Disable" : "Enable"}</button>
              <button class="mini-button danger" type="button" data-payment-action="remove" data-id="${method.id}">Remove</button>
            </div>
          </div>
        `).join("")}
      </section>`;
  }).join("");
};

const loadPaymentMethods = async () => {
  const data = await request("/api/payment-methods");
  paymentMethods = data.methods;
  renderPaymentMethods();
};

const closeAdminPayment = () => {
  paymentPanel.hidden = true;
  paymentBackdrop.hidden = true;
};

document.getElementById("admin-payment-toggle").addEventListener("click", async () => {
  closeAdminChat();
  closePlayerDrawer();
  paymentPanel.hidden = false;
  paymentBackdrop.hidden = false;
  try { await loadPaymentMethods(); }
  catch (error) { setNotice(error.message, true); }
});
document.getElementById("admin-payment-close").addEventListener("click", closeAdminPayment);
paymentBackdrop.addEventListener("click", closeAdminPayment);

document.getElementById("payment-method-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/payment-methods", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        methodName: document.getElementById("payment-method-name").value,
        paymentId: document.getElementById("payment-method-id").value,
      }),
    });
    form.reset();
    await loadPaymentMethods();
    setNotice("Payment ID added.");
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
});

paymentMethodList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-payment-action]");
  if (!button) return;
  const action = button.dataset.paymentAction;
  const method = paymentMethods.find((candidate) => candidate.id === button.dataset.id);
  if (action === "remove" && !window.confirm(`Remove ${method?.paymentId || "this payment ID"}?`)) return;
  button.disabled = true;
  try {
    await request("/api/payment-methods", {
      method: "POST",
      body: JSON.stringify({
        action,
        id: button.dataset.id,
        methodName: button.dataset.methodName ? decodeURIComponent(button.dataset.methodName) : undefined,
      }),
    });
    await loadPaymentMethods();
    setNotice(action === "rotate" ? "Payment ID rotated." : "Payment methods updated.");
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
});

const refresh = async () => {
  const days = Number(document.getElementById("report-range").value);
  const [playerData, reportData] = await Promise.all([request("/api/admin/players"), request(`/api/admin/reports?days=${days}`), loadRequests()]);
  players = playerData.players;
  report = reportData;
  renderPlayers();
  renderReport();
  if (!document.querySelector('[data-panel="api-flow"]').hidden) await loadApiFlow();
  setChatBadge(report.attention.unreadMessages);
  if (drawerPlayerId) openPlayerDrawer(drawerPlayerId, { quiet: true });
};

const showDashboard = async (admin) => {
  if (admin.role !== "admin") throw new Error("This login does not have admin access");
  document.getElementById("admin-identity").textContent = admin.loginId;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  openTab(window.location.hash.slice(1), false);
  await refresh();
  pollChatSummary();
  // Keep the queue and numbers fresh while the dashboard is open.
  setInterval(() => {
    if (document.visibilityState === "visible") refresh().catch(() => {});
  }, 60_000);
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
      body: JSON.stringify({ loginId: document.getElementById("admin-login-id").value, pin: document.getElementById("admin-login-pin").value, portal: "admin" }),
    });
    await showDashboard(data.player);
  } catch (failure) { error.textContent = failure.message; }
  finally { button.disabled = false; }
});

document.getElementById("create-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await request("/api/admin/players", { method: "POST", body: JSON.stringify({ action: "create", loginId: document.getElementById("new-login-id").value, pin: document.getElementById("new-login-pin").value }) });
    form.reset();
    setNotice("Player account created.");
    await refresh();
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
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
  const playerCount = players.filter((player) => player.role === "player").length;
  if (!window.confirm(`TESTING ONLY — PERMANENT\n\nDelete ALL ${playerCount} active and archived player accounts, lifetime totals, payments, ledger entries, game rounds, chats, sessions, and login-attempt data?\n\nAlso clear Nerd RTP/limit overrides and house history, reset the bank to its configured starting amount, and turn all games back on. Game names, logos, and order stay unchanged. Admin accounts and credentials remain. This cannot be undone.`)) return;
  const phrase = window.prompt('Type HARD RESET EVERYTHING to permanently continue:');
  if (phrase !== "HARD RESET EVERYTHING") {
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
    window.alert(`Hard reset complete. ${deleted} records were cleared. Nerd controls and the house bank were reset, and all games were turned on. Admin accounts remain. You have been signed out.`);
    window.location.replace("/admin.html");
  } catch (error) { setNotice(error.message, true); }
  finally { button.disabled = false; }
});
// The three range pickers stay in sync; any of them reloads the whole dashboard.
const RANGE_SELECTS = ["overview-range", "report-range", "analytics-range"].map((id) => document.getElementById(id));
RANGE_SELECTS.forEach((select) => select.addEventListener("change", async () => {
  const days = Number(select.value);
  RANGE_SELECTS.forEach((other) => { other.value = String(days); });
  document.getElementById("download-pdf").href = `/api/admin/report-pdf?days=${days}`;
  try { await refresh(); } catch (error) { setNotice(error.message, true); }
}));
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

request("/api/auth/me")
  .then(({ player }) => showDashboard(player))
  .catch(() => {})
  .finally(() => document.body.classList.remove("admin-booting"));


// ---------- Nerd: central game math and the house bank ----------
const nerdGames = document.getElementById("nerd-games");
const bankFigures = document.getElementById("bank-figures");
const bankControls = document.getElementById("bank-controls");
const bankLedger = document.getElementById("bank-ledger");
let nerd = null;
const pct = (value, digits = 2) => (value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(digits)}%`);
const LEDGER_KINDS = {
  start: "Starting bank", capital: "Capital added", withdraw: "Profit taken", bonus: "Bonus paid",
  admin_credit: "Player funded", payment_deposit: "Payment received", cashout: "Cash out sent",
};

const renderBank = () => {
  const { house } = nerd;
  const profit = house.profitCents;
  bankFigures.innerHTML = [
    ["Bank balance", money(house.balanceCents), "What games can pay out"],
    ["Capital", money(house.capitalCents), "What you put in"],
    ["Profit", `${profit < 0 ? "−" : ""}${money(Math.abs(profit))}`, profit < 0 ? "Players are ahead; earning it back" : "Earned above capital", profit < 0 ? "negative" : "positive"],
    ["Bonus budget", money(Math.max(0, profit)), "Bonuses can spend this"],
    ["Bonuses paid", money(house.bonusesPaidCents), "From profit"],
    ["Profit taken", money(house.withdrawnCents), "Moved out of the bank"],
  ].map(([label, value, note, tone = ""]) => `<div class="bank-figure ${tone}"><small>${label}</small><strong>${value}</strong><span>${note}</span></div>`).join("");
  bankControls.innerHTML = house.fresh ? `
      <form class="bank-form" data-bank="house_start">
        <span class="bank-form-title">Starting bank</span>
        <div class="bank-options">${house.startOptionsCents.map((cents) => `<button type="button" class="chip-option${cents === house.capitalCents ? " on" : ""}" data-start="${cents}">${money(cents).replace(".00", "")}</button>`).join("")}</div>
        <label class="money-input"><span>$</span><input name="amount" inputmode="decimal" value="${house.capitalCents / 100}" aria-label="Starting bank in dollars" /></label>
        <button class="button primary" type="submit">Set starting bank</button>
        <small class="helper">Default ${money(house.defaultStartCents).replace(".00", "")}. You can pick it until the first game is played; after that, add capital.</small>
      </form>` : `
      <form class="bank-form" data-bank="house_capital">
        <span class="bank-form-title">Add capital</span>
        <label class="money-input"><span>$</span><input name="amount" inputmode="decimal" placeholder="500" aria-label="Capital to add in dollars" /></label>
        <button class="button dark" type="submit">Add to bank</button>
      </form>
      <form class="bank-form" data-bank="house_withdraw">
        <span class="bank-form-title">Take profit</span>
        <label class="money-input"><span>$</span><input name="amount" inputmode="decimal" placeholder="${Math.max(0, profit) / 100}" aria-label="Profit to take in dollars" /></label>
        <button class="button dark" type="submit" ${profit <= 0 ? "disabled" : ""}>Take profit</button>
        <small class="helper">Up to ${money(Math.max(0, profit))}. Capital always stays in the bank.</small>
      </form>`;
  bankLedger.innerHTML = nerd.ledger.map((entry) => `
    <tr><td data-label="When">${date(entry.createdAt)}</td><td data-label="What">${LEDGER_KINDS[entry.kind] || entry.kind}${entry.reference ? `<small class="cell-note">${escapeHtml(entry.reference)}</small>` : ""}</td>
    <td data-label="Amount" class="money ${entry.amountCents < 0 ? "negative" : ""}">${entry.amountCents < 0 ? "−" : "+"}${money(Math.abs(entry.amountCents))}</td>
    <td data-label="Bank after" class="money">${money(entry.balanceAfterCents)}</td><td data-label="By">${escapeHtml(entry.by || "—")}</td></tr>`).join("")
    || "<tr><td colspan='5' class='empty-cell'>No bank changes yet.</td></tr>";
};

const gameRow = (game) => {
  const { settings, live, day, all } = game;
  const target = settings.rtp ?? game.baseRtp;
  const usage = Math.min(1.2, live.usage);
  const throttled = live.throttle < 1;
  const figure = (label, value, warn = false) => `<div><dt>${label}</dt><dd class="${warn ? "warn" : ""}">${value}</dd></div>`;
  return `
    <form class="nerd-game${settings.enabled ? "" : " paused"}" data-game="${game.id}">
      <header class="ng-head">
        <div class="ng-title"><b>${escapeHtml(game.title)}</b><code>${game.id}</code></div>
        <span class="ng-tags"><i>${game.runtime === "builtin" ? "built in" : game.runtime}</i><i>${game.model}</i><i>bets ${game.bets.join(" · ")}</i><i>up to ${game.maxMultiplier}×</i></span>
        <div class="ng-head-actions">
          <label class="toggle"><input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""} /><span class="toggle-track"><i></i></span><b>${settings.enabled ? "Live" : "Paused"}</b></label>
          <span class="ng-save"><button class="button primary" type="submit" disabled>Save</button></span>
        </div>
      </header>

      <div class="ng-body">
        <section class="ng-rtp" aria-label="Return to player">
          <div class="ng-label"><span>Target RTP</span><output name="rtpOut">${pct(target)}</output></div>
          <input type="range" name="rtp" min="${game.minRtp}" max="${game.maxRtp}" step="0.0025" value="${target}" aria-label="Target RTP for ${escapeHtml(game.title)}" />
          <div class="ng-scale"><span>${pct(game.minRtp, 0)}</span><button type="button" class="link-reset" data-reset-rtp="${game.baseRtp}">Reset to ${pct(game.baseRtp)}</button><span>${pct(game.maxRtp, 0)}</span></div>
          <dl class="ng-grid">
            ${figure("Now", pct(live.effectiveRtp), throttled)}
            ${figure("Throttle", throttled ? `×${live.throttle.toFixed(2)}` : "Off", throttled)}
            ${figure("Seen 24h", pct(day.observedRtp, 1))}
            ${figure("Seen all time", pct(all.observedRtp, 1))}
          </dl>
        </section>

        <section class="ng-limits" aria-label="Limits">
          <label class="ng-field"><span>Max single win</span><span class="money-input"><span>$</span><input name="maxWin" inputmode="decimal" value="${settings.maxWinCents / 100}" /></span></label>
          <label class="ng-field"><span>Daily payout limit</span><span class="money-input"><span>$</span><input name="dailyLimit" inputmode="decimal" value="${settings.dailyLimitCents / 100}" /></span></label>
          <div class="usage" title="Net paid out in the last 24 hours vs the daily limit">
            <div class="usage-row"><span>Used today</span><b>${pct(Math.max(0, live.usage), 0)}</b></div>
            <div class="usage-bar"><i style="width:${(Math.max(0, usage) / 1.2) * 100}%" class="${usage >= 1 ? "full" : usage > 0.5 ? "hot" : ""}"></i><b style="left:${(0.5 / 1.2) * 100}%"></b><b style="left:${(1 / 1.2) * 100}%"></b></div>
            <small>${day.net > 0 ? `${money(day.net)} paid out net` : `${money(-day.net)} earned`} in the last 24h</small>
          </div>
        </section>

        <section class="ng-activity" aria-label="Activity">
          <dl class="ng-grid">
            ${figure("Rounds 24h", day.rounds.toLocaleString("en-US"))}
            ${figure("Rounds all", all.rounds.toLocaleString("en-US"))}
            ${figure("Wagered 24h", money(day.wagered))}
            ${figure("Paid 24h", money(day.paid))}
          </dl>
          <div class="winners"><small>Top winners 24h</small>${game.topWinners.length ? `<ol>${game.topWinners.map((winner) => `<li><button type="button" class="inline-link" data-player-details="${winner.playerId}">${escapeHtml(winner.loginId)}</button><code title="Player ID">${winner.playerId.slice(0, 8)}</code><b>+${money(winner.netCents)}</b></li>`).join("")}</ol>` : "<p>No one is ahead.</p>"}</div>
        </section>
      </div>
    </form>`;
};

const renderNerd = () => {
  renderBank();
  nerdGames.innerHTML = nerd.games.map(gameRow).join("");
};

async function loadNerd() {
  try {
    nerd = await request("/api/admin/reports?view=nerd");
    renderNerd();
  } catch (error) {
    nerdGames.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

const nerdPost = async (body, button) => {
  if (button) button.disabled = true;
  try {
    nerd = await request("/api/admin/reports", { method: "POST", body: JSON.stringify(body) });
    renderNerd();
    return true;
  } catch (error) {
    window.alert(error.message);
    if (button) button.disabled = false;
    return false;
  }
};

bankControls.addEventListener("click", (event) => {
  const option = event.target.closest("[data-start]");
  if (!option) return;
  const form = option.closest("form");
  form.querySelector("input[name=amount]").value = Number(option.dataset.start) / 100;
  form.querySelectorAll("[data-start]").forEach((item) => item.classList.toggle("on", item === option));
});
bankControls.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const amountCents = dollarsToCents(form.querySelector("input[name=amount]").value);
  if (!amountCents) return;
  const action = form.dataset.bank;
  const verb = { house_start: "Set the starting bank to", house_capital: "Add", house_withdraw: "Take" }[action];
  if (!window.confirm(`${verb} ${money(amountCents)}?`)) return;
  nerdPost({ action, amountCents }, form.querySelector("button[type=submit]"));
});

nerdGames.addEventListener("input", (event) => {
  const form = event.target.closest("form[data-game]");
  if (!form) return;
  if (event.target.name === "rtp") form.querySelector("output[name=rtpOut]").textContent = pct(event.target.value);
  form.querySelector(".ng-save button").disabled = false;
  form.classList.add("dirty");
});
nerdGames.addEventListener("click", (event) => {
  const reset = event.target.closest("[data-reset-rtp]");
  if (!reset) return;
  const form = reset.closest("form");
  const slider = form.querySelector("input[name=rtp]");
  slider.value = reset.dataset.resetRtp;
  slider.dispatchEvent(new Event("input", { bubbles: true }));
});
nerdGames.addEventListener("change", (event) => {
  if (event.target.name !== "enabled") return;
  event.target.closest(".toggle").querySelector("b").textContent = event.target.checked ? "Live" : "Paused";
});
nerdGames.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const game = nerd.games.find((item) => item.id === form.dataset.game);
  const rtp = Number(form.elements.rtp.value);
  nerdPost({
    action: "game_settings",
    gameId: game.id,
    // Back at the game's own RTP: store "no override".
    rtp: Math.abs(rtp - game.baseRtp) < 0.0001 ? null : rtp,
    maxWinCents: dollarsToCents(form.elements.maxWin.value),
    dailyLimitCents: dollarsToCents(form.elements.dailyLimit.value),
    enabled: form.elements.enabled.checked,
  }, form.querySelector(".ng-save button"));
});


// ---------- Games: the registry behind the lobby ----------
const gamesList = document.getElementById("games-list");
const gamesSearch = document.getElementById("games-search");
const gamesAdd = document.getElementById("games-add");
const logoInput = document.getElementById("games-logo-input");
let registry = { games: [], categories: [] };
let gamesFilter = "all";
let logoTarget = null;
const SHEET = { url: "/assets/gamish-game-icons.png", width: 1484, height: 1060 };

const logoStyle = (game, size = 56) => {
  const image = game.logoUrl || game.coverUrl;
  if (image) return `background-image:url('${image}');background-size:cover;background-position:center`;
  if (game.artCell) {
    const [x, y, w, h] = game.artCell;
    const sx = size / w;
    const sy = size / h;
    return `background-image:url('${SHEET.url}');background-size:${SHEET.width * sx}px ${SHEET.height * sy}px;background-position:${-x * sx}px ${-y * sy}px`;
  }
  return "background-image:url('/assets/phoenix-ruby.webp');background-size:cover;background-position:center";
};

const typeBadge = (game) => game.kind === "playable"
  ? `<span class="type-badge playable">Playable<small>${game.runtime === "builtin" ? "built in" : "module"}</small></span>`
  : "<span class=\"type-badge soon\">Coming soon</span>";

const gameRowHtml = (game, index, list) => `
  <div class="game-row${game.enabled ? "" : " off"}" data-game-id="${game.id}">
    <div class="gr-order">
      <button type="button" class="order-button" data-move="-1" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeHtml(game.name)} up">▲</button>
      <button type="button" class="order-button" data-move="1" ${index === list.length - 1 ? "disabled" : ""} aria-label="Move ${escapeHtml(game.name)} down">▼</button>
    </div>
    <div class="gr-logo">
      <button type="button" class="logo-box" data-logo-upload style="${logoStyle(game)}" aria-label="Change the logo of ${escapeHtml(game.name)}"><span>Change</span></button>
      ${game.logoUrl ? "<button type=\"button\" class=\"link-reset\" data-logo-remove>Remove</button>" : ""}
    </div>
    <div class="gr-name">
      <input class="name-input" value="${escapeHtml(game.name)}" maxlength="40" aria-label="Name" data-field="name" />
      <code title="Game ID">${game.id}</code>
    </div>
    <div class="gr-category">
      <select data-field="category" aria-label="Category">${registry.categories.map((category) => `<option ${category === game.category ? "selected" : ""}>${category}</option>`).join("")}</select>
    </div>
    <div class="gr-type">${typeBadge(game)}</div>
    <div class="gr-stats">${game.kind === "playable" ? `<b>${game.rounds24h.toLocaleString("en-US")}</b> rounds<br><b>${game.players24h}</b> players` : "<span class=\"muted\">—</span>"}</div>
    <div class="gr-toggle">
      <label class="toggle"><input type="checkbox" data-field="enabled" ${game.enabled ? "checked" : ""} /><span class="toggle-track"><i></i></span><b>${game.enabled ? "On" : "Off"}</b></label>
    </div>
    <div class="gr-actions">${game.kind === "coming_soon" ? `<button type="button" class="mini-button danger" data-delete-game aria-label="Delete ${escapeHtml(game.name)}">Delete</button>` : ""}</div>
  </div>`;

const visibleGames = () => {
  const query = gamesSearch.value.trim().toLowerCase();
  return registry.games.filter((game) => {
    if (query && !game.name.toLowerCase().includes(query) && !game.id.includes(query)) return false;
    if (gamesFilter === "on") return game.enabled;
    if (gamesFilter === "off") return !game.enabled;
    if (gamesFilter === "playable" || gamesFilter === "coming_soon") return game.kind === gamesFilter;
    return true;
  });
};

const renderGames = () => {
  const list = visibleGames();
  const on = registry.games.filter((game) => game.enabled).length;
  document.getElementById("games-count").textContent = `${on} of ${registry.games.length} on`;
  // Reordering only makes sense on the full list.
  const ordering = gamesFilter === "all" && !gamesSearch.value.trim();
  gamesList.classList.toggle("no-order", !ordering);
  gamesList.innerHTML = list.map(gameRowHtml).join("") || "<p class='helper'>No games match.</p>";
  renderTrash();
  document.getElementById("games-add-category").innerHTML = registry.categories.map((category) => `<option>${category}</option>`).join("");
};

async function loadGames() {
  try {
    registry = await request("/api/admin/reports?view=games");
    renderGames();
  } catch (error) {
    gamesList.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

const gamesPost = async (body) => {
  try {
    registry = await request("/api/admin/reports", { method: "POST", body: JSON.stringify(body) });
    renderGames();
    return true;
  } catch (error) {
    window.alert(error.message);
    renderGames();
    return false;
  }
};

gamesSearch.addEventListener("input", renderGames);
document.querySelectorAll("[data-games-filter]").forEach((button) => button.addEventListener("click", () => {
  gamesFilter = button.dataset.gamesFilter;
  document.querySelectorAll("[data-games-filter]").forEach((item) => item.classList.toggle("on", item === button));
  renderGames();
}));
document.getElementById("games-add-toggle").addEventListener("click", () => {
  gamesAdd.hidden = !gamesAdd.hidden;
  if (!gamesAdd.hidden) gamesAdd.elements.id.focus();
});
gamesAdd.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = gamesAdd.elements;
  if (await gamesPost({ action: "game_add", id: form.id.value.trim(), name: form.name.value.trim(), category: form.category.value })) {
    gamesAdd.reset();
    gamesAdd.hidden = true;
  }
});

const rowId = (element) => element.closest("[data-game-id]")?.dataset.gameId;

gamesList.addEventListener("change", (event) => {
  const id = rowId(event.target);
  const field = event.target.dataset.field;
  if (!id || !field) return;
  const value = field === "enabled" ? event.target.checked : event.target.value;
  if (field === "name" && value.trim() === registry.games.find((game) => game.id === id)?.name) return;
  gamesPost({ action: "game_update", id, [field]: value });
});
gamesList.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.classList.contains("name-input")) event.target.blur();
});

gamesList.addEventListener("click", (event) => {
  const id = rowId(event.target);
  if (!id) return;
  const move = event.target.closest("[data-move]");
  if (move) {
    const ids = registry.games.map((game) => game.id);
    const from = ids.indexOf(id);
    const to = from + Number(move.dataset.move);
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    gamesPost({ action: "game_order", ids });
    return;
  }
  if (event.target.closest("[data-logo-upload]")) {
    logoTarget = id;
    logoInput.value = "";
    logoInput.click();
    return;
  }
  if (event.target.closest("[data-logo-remove]")) {
    if (window.confirm("Remove this logo? The lobby goes back to the built-in art.")) gamesPost({ action: "game_logo", id, logo: null });
    return;
  }
  if (event.target.closest("[data-delete-game]")) askTrash(registry.games.find((item) => item.id === id));
});

// Logos are cropped to a centred square and shrunk in the browser before upload (≤ 200 KB).
const prepareLogo = (file) => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error("Pick a PNG, JPEG or WebP image"));
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    for (const [size, quality] of [[384, 0.88], [320, 0.8], [256, 0.72], [192, 0.65]]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(image, sx, sy, side, side, 0, 0, size, size);
      let data = canvas.toDataURL("image/webp", quality);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
      if (data.length * 0.75 < 195 * 1024) return resolve(data);
    }
    reject(new Error("That image is too detailed to fit 200 KB; try a simpler one"));
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("Couldn't read that image"));
  };
  image.src = url;
});

logoInput.addEventListener("change", async () => {
  const file = logoInput.files?.[0];
  if (!file || !logoTarget) return;
  try {
    const logo = await prepareLogo(file);
    await gamesPost({ action: "game_logo", id: logoTarget, logo });
  } catch (error) {
    window.alert(error.message);
  }
});


// Deleting: confirm by typing the ID, then the game waits 24 hours in the trash.
const trashDialog = document.getElementById("trash-dialog");
const trashConfirm = document.getElementById("trash-confirm");
const trashSubmit = document.getElementById("trash-submit");
let trashTarget = null;
const askTrash = (game) => {
  trashTarget = game;
  document.getElementById("trash-name").textContent = `"${game.name}"`;
  document.getElementById("trash-id").textContent = game.id;
  trashConfirm.value = "";
  trashSubmit.disabled = true;
  trashDialog.showModal();
  trashConfirm.focus();
};
trashConfirm.addEventListener("input", () => { trashSubmit.disabled = trashConfirm.value.trim() !== trashTarget?.id; });
trashDialog.addEventListener("close", () => {
  if (trashDialog.returnValue === "delete" && trashTarget && trashConfirm.value.trim() === trashTarget.id) {
    gamesPost({ action: "game_delete", id: trashTarget.id, confirmId: trashConfirm.value.trim() });
  }
  trashTarget = null;
});

const timeLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
};
function renderTrash() {
  const trash = registry.trash || [];
  document.getElementById("games-trash").hidden = trash.length === 0;
  document.getElementById("games-trash-list").innerHTML = trash.map((game) => `
    <div class="trash-row" data-game-id="${game.id}">
      <span class="logo-box small" style="${logoStyle(game, 40)}"></span>
      <div class="trash-name"><b>${escapeHtml(game.name)}</b><code>${game.id}</code></div>
      <span class="trash-when">Deleted ${inboxTime(game.deletedAt)} · removed for good ${timeLeft(game.purgeAt)}</span>
      <button type="button" class="button dark" data-restore-game>Restore</button>
    </div>`).join("");
}
document.getElementById("games-trash-list").addEventListener("click", (event) => {
  const id = event.target.closest("[data-restore-game]") && rowId(event.target);
  if (id) gamesPost({ action: "game_restore", id });
});
