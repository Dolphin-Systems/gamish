(() => {
  "use strict";

  const app = document.getElementById("app");
  const loginView = document.getElementById("login-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutButton = document.getElementById("logout-button");
  const walletBalance = document.getElementById("wallet-balance");
  const walletPlayerId = document.getElementById("wallet-player-id");
  const accountInitial = document.getElementById("account-initial");
  const chatImages = window.GamishChatImages;

  const request = async (url, { timeout, ...options } = {}) => {
    const controller = timeout ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), timeout) : null;
    let response;
    try {
      response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        signal: controller?.signal,
        headers: {
          ...(options.body ? { "Content-Type": "application/json", "X-Gamish-Action": "1" } : {}),
          ...options.headers,
        },
      });
    } catch (error) {
      throw new Error(error.name === "AbortError" ? "The connection is slow. Please try again." : "You appear to be offline.");
    } finally {
      window.clearTimeout(timer);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Request failed");
    return payload;
  };

  const dollars = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);

  const setWallet = (player) => {
    if (!player) return;
    // One credit is one cent, so the wallet reads in dollars like the payment apps players use.
    walletBalance.textContent = dollars(player.totalCredits);
    document.getElementById("wallet-split").textContent = `${dollars(player.regularCredits)} cashable · ${dollars(player.bonusCredits)} bonus`;
    walletPlayerId.textContent = player.loginId;
    accountInitial.textContent = player.loginId.charAt(0).toUpperCase();
    document.getElementById("pay-player-id").textContent = player.loginId;
    window.dispatchEvent(new CustomEvent("gamish:cashable", { detail: Number(player.regularCredits || 0) }));
  };

  const applyPlayer = (player) => {
    window.GamishAccount.player = player;
    setWallet(player);
    loginView.classList.add("hidden");
    app.classList.remove("account-locked");
    app.setAttribute("aria-hidden", "false");
    window.dispatchEvent(new CustomEvent("gamish:account", { detail: player }));
    window.dispatchEvent(new CustomEvent("gamish:authenticated", { detail: player }));
  };

  const lockApp = () => {
    window.GamishAccount.player = null;
    loginView.classList.remove("hidden");
    app.classList.add("account-locked");
    app.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new CustomEvent("gamish:signedout"));
  };

  const refreshWallet = async () => {
    const data = await request("/api/player/wallet");
    const player = { ...window.GamishAccount.player, ...data.wallet, loginId: data.loginId };
    window.GamishAccount.player = player;
    setWallet(player);
    window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: player }));
    return player;
  };

  window.GamishAccount = { player: null, request, refreshWallet };
  window.addEventListener("gamish:wallet", (event) => setWallet(event.detail));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const button = loginForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking…";
    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          loginId: document.getElementById("login-id").value,
          pin: document.getElementById("login-pin").value,
          portal: "player",
        }),
      });
      applyPlayer(data.player);
      loginForm.reset();
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Enter Gamish777";
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await request("/api/auth/logout", { method: "POST", body: "{}" });
    } finally {
      lockApp();
    }
  });

  request("/api/auth/me").then(async ({ player }) => {
    if (player.role === "admin") {
      await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
      lockApp();
      loginError.textContent = "Admins sign in at /admin.html";
      return;
    }
    applyPlayer(player);
  }).catch(lockApp);

  const views = new Map([
    ["arcade", document.getElementById("arcade-view")],
    ["payments", document.getElementById("payments-view")],
    ["messages", document.getElementById("messages-view")],
  ]);
  const viewTriggers = [...document.querySelectorAll(".view-trigger")];
  const utilityButtons = [...document.querySelectorAll(".utility-button")];
  const soundToggle = document.getElementById("sound-toggle");
  const audio = window.GamishAudio;
  const toast = document.getElementById("toast");
  let toastTimer;

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  };

  let currentView = "arcade";

  const showView = (name) => {
    const next = views.get(name);
    if (!next) return;
    views.forEach((view, key) => {
      const isActive = key === name;
      view.classList.toggle("active", isActive);
      view.setAttribute("aria-hidden", String(!isActive));
      if (isActive && view.classList.contains("page-view")) view.scrollTop = 0;
    });
    utilityButtons.forEach((item) => {
      const isActive = item.dataset.view === name;
      item.classList.toggle("active", isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    currentView = name;
    document.body.dataset.view = name;
    window.dispatchEvent(new CustomEvent("gamish:view", { detail: name }));
  };

  viewTriggers.forEach((item) => item.addEventListener("click", () => {
    audio?.play("nav");
    showView(item.dataset.view);
  }));
  window.addEventListener("gamish:navigate", (event) => showView(event.detail));

  const refreshSoundToggle = () => {
    const isEnabled = audio?.isEnabled() ?? false;
    soundToggle.classList.toggle("muted", !isEnabled);
    soundToggle.setAttribute("aria-pressed", String(isEnabled));
    soundToggle.setAttribute("aria-label", isEnabled ? "Mute sound" : "Turn sound on");
    soundToggle.title = isEnabled ? "Sound on" : "Sound off";
  };

  soundToggle.addEventListener("click", () => {
    audio?.toggle();
    refreshSoundToggle();
  });
  window.addEventListener("gamish:soundchange", refreshSoundToggle);
  refreshSoundToggle();

  // ---------- Wallet: deposits, cash-outs and request status ----------

  const amountButtons = [...document.querySelectorAll(".amount-chip")];
  const customAmount = document.getElementById("custom-amount");
  const amountLabel = document.getElementById("amount-label");
  const methodGrid = document.getElementById("payment-method-grid");
  const methodLabel = document.getElementById("method-label");
  const payInstructions = document.getElementById("pay-instructions");
  const depositButton = document.getElementById("submit-deposit");
  const depositNote = document.getElementById("deposit-note");
  const cashoutAmount = document.getElementById("cashout-amount");
  const cashoutMethod = document.getElementById("cashout-method");
  const cashoutHandle = document.getElementById("cashout-handle");
  const cashoutButton = document.getElementById("submit-cashout");
  const requestList = document.getElementById("request-list");
  const BONUS_TIERS = [[100, 25], [50, 10], [20, 5]];
  let selectedAmount = 5;
  let selectedMethod = null;
  let methodCards = [];
  let paymentMethods = [];
  let requests = [];
  let cashableCents = 0;
  let requestTimer;

  const bonusFor = (amount) => (BONUS_TIERS.find(([minimum]) => amount >= minimum) || [0, 0])[1];
  const toCents = (value) => Math.round(Number(String(value).replace(/[^0-9.]/g, "")) * 100);

  const refreshDepositSummary = () => {
    const amountText = dollars(Math.round(selectedAmount * 100));
    const bonus = bonusFor(selectedAmount);
    amountLabel.textContent = bonus ? `${amountText} + $${bonus} bonus` : `${amountText} selected`;
    document.getElementById("pay-amount").textContent = amountText;
    const ready = selectedMethod && selectedAmount >= 1 && selectedAmount <= 1000;
    depositButton.disabled = !ready;
    depositButton.querySelector("span").textContent = !selectedMethod
      ? "Choose a method to continue"
      : selectedAmount < 1 || selectedAmount > 1000 ? "Enter $1 to $1,000" : `I've sent ${amountText}`;
  };

  const updateAmount = (amount, source) => {
    const parsed = Number(amount);
    selectedAmount = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9999) : 0;
    amountButtons.forEach((button) => button.classList.toggle("selected", button === source));
    refreshDepositSummary();
  };

  amountButtons.forEach((button) => button.addEventListener("click", () => {
    audio?.play("tap");
    customAmount.value = button.dataset.amount;
    updateAmount(button.dataset.amount, button);
  }));
  customAmount.addEventListener("input", () => updateAmount(customAmount.value.replace(/[^0-9.]/g, ""), null));

  const paymentTone = (name) => {
    const normalized = name.toLowerCase();
    if (normalized.includes("cash")) return "cash";
    if (normalized.includes("chime")) return "chime";
    if (normalized.includes("paypal")) return "paypal";
    if (normalized.includes("venmo")) return "venmo";
    return "custom";
  };

  const selectMethod = (card) => {
    selectedMethod = card;
    methodCards.forEach((item) => item.classList.toggle("selected", item === card));
    methodLabel.textContent = card ? `${card.dataset.method} selected` : "Choose a method";
    payInstructions.hidden = !card;
    if (card) {
      document.getElementById("pay-method-name").textContent = `${card.dataset.method} · send to`;
      document.getElementById("pay-handle").textContent = card.dataset.handle;
      payInstructions.dataset.tone = paymentTone(card.dataset.method);
    }
    refreshDepositSummary();
  };

  const renderPaymentMethods = () => {
    methodGrid.replaceChildren();
    const previous = selectedMethod?.dataset.method;
    selectedMethod = null;
    methodCards = [];
    if (!paymentMethods.length) {
      const empty = document.createElement("p");
      empty.className = "payment-method-empty";
      empty.textContent = "Payment methods are being updated. Please check again shortly.";
      methodGrid.append(empty);
      selectMethod(null);
    } else {
      methodCards = paymentMethods.map((method) => {
        const card = document.createElement("button");
        const logo = document.createElement("span");
        const name = document.createElement("b");
        const paymentId = document.createElement("small");
        const check = document.createElement("i");
        card.className = "method-card";
        card.type = "button";
        card.dataset.method = method.methodName;
        card.dataset.handle = method.paymentId;
        card.setAttribute("aria-label", `${method.methodName}, ${method.paymentId}`);
        logo.className = `method-logo ${paymentTone(method.methodName)}`;
        logo.textContent = method.methodName.charAt(0).toUpperCase();
        name.textContent = method.methodName;
        paymentId.textContent = method.paymentId;
        check.textContent = "✓";
        card.append(logo, name, paymentId, check);
        card.addEventListener("click", () => {
          audio?.play("tap");
          selectMethod(card);
        });
        methodGrid.append(card);
        return card;
      });
      selectMethod(methodCards.find((card) => card.dataset.method === previous) || null);
    }
    // Cash-outs can go to any method players use; offer the known ones plus "Other".
    const current = cashoutMethod.value;
    const names = [...new Set([...paymentMethods.map((method) => method.methodName), "Cash App", "Chime", "PayPal", "Venmo"])];
    cashoutMethod.replaceChildren(...names.map((name) => new Option(name, name)), new Option("Other", "Other"));
    if (current) cashoutMethod.value = current;
  };

  const loadPaymentMethods = async () => {
    const data = await request("/api/payment-methods");
    paymentMethods = data.methods;
    renderPaymentMethods();
  };

  document.getElementById("copy-pay-handle").addEventListener("click", async () => {
    const handle = document.getElementById("pay-handle").textContent;
    try {
      await navigator.clipboard.writeText(handle);
      showToast(`Copied ${handle}`);
    } catch {
      showToast(handle);
    }
    audio?.play("tap");
  });

  document.querySelectorAll("[data-wallet-tab]").forEach((tab) => tab.addEventListener("click", () => {
    audio?.play("tap");
    document.querySelectorAll("[data-wallet-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-wallet-panel]").forEach((panel) => { panel.hidden = panel.dataset.walletPanel !== tab.dataset.walletTab; });
  }));

  const pendingCashoutCents = () => requests
    .filter((item) => item.kind === "cashout" && item.status === "pending")
    .reduce((sum, item) => sum + item.amountCents, 0);

  const refreshCashable = () => {
    const available = Math.max(0, cashableCents - pendingCashoutCents());
    document.getElementById("cashout-available").textContent = `Up to ${dollars(available)}`;
    return available;
  };
  window.addEventListener("gamish:cashable", (event) => {
    cashableCents = event.detail;
    refreshCashable();
  });

  document.querySelectorAll("[data-cashout-fraction]").forEach((button) => button.addEventListener("click", () => {
    audio?.play("tap");
    const cents = Math.floor(refreshCashable() * Number(button.dataset.cashoutFraction));
    cashoutAmount.value = (cents / 100).toFixed(2).replace(/\.00$/, "");
  }));

  const STATUS_LABELS = { pending: "Pending", approved: "Completed", declined: "Declined", cancelled: "Cancelled" };
  const requestTime = (value) => new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const renderRequests = () => {
    requestList.replaceChildren();
    if (!requests.length) {
      const empty = document.createElement("p");
      empty.className = "request-empty";
      empty.textContent = "No requests yet. Deposits and cash-outs you send will appear here.";
      requestList.append(empty);
      return;
    }
    for (const item of requests) {
      const row = document.createElement("article");
      row.className = `request-row ${item.kind} ${item.status}`;
      const icon = document.createElement("span");
      icon.className = "request-icon";
      icon.textContent = item.kind === "deposit" ? "↓" : "↑";
      const body = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.kind === "deposit" ? `Deposit · ${item.methodName}` : `Cash out · ${item.methodName}`;
      const meta = document.createElement("small");
      meta.textContent = item.kind === "deposit" ? `${requestTime(item.createdAt)} · sent to ${item.paymentHandle}` : `${requestTime(item.createdAt)} · to ${item.paymentHandle}`;
      body.append(title, meta);
      if (item.status === "approved" && item.kind === "deposit" && (item.creditedCents !== item.amountCents || item.bonusCents)) {
        const extra = document.createElement("small");
        extra.className = "request-extra";
        extra.textContent = `${dollars(item.creditedCents)} credited${item.bonusCents ? ` + ${dollars(item.bonusCents)} bonus` : ""}`;
        body.append(extra);
      }
      if (item.adminNote) {
        const note = document.createElement("small");
        note.className = "request-note";
        note.textContent = `“${item.adminNote}”`;
        body.append(note);
      }
      const side = document.createElement("div");
      side.className = "request-side";
      const amount = document.createElement("strong");
      amount.textContent = `${item.kind === "deposit" ? "+" : "−"}${dollars(item.amountCents)}`;
      const status = document.createElement("span");
      status.className = `request-status ${item.status}`;
      status.textContent = STATUS_LABELS[item.status] || item.status;
      side.append(amount, status);
      if (item.status === "pending") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "request-cancel";
        cancel.dataset.cancelRequest = item.id;
        cancel.textContent = "Cancel";
        side.append(cancel);
      }
      row.append(icon, body, side);
      requestList.append(row);
    }
  };

  const scheduleRequestPoll = () => {
    window.clearTimeout(requestTimer);
    // Poll quickly while the wallet is open, slowly while something is pending elsewhere.
    const pending = requests.some((item) => item.status === "pending");
    if (!pending && currentView !== "payments") return;
    requestTimer = window.setTimeout(() => loadRequests().catch(() => {}), currentView === "payments" ? 10_000 : 25_000);
  };

  const loadRequests = async () => {
    if (!window.GamishAccount.player) return;
    const before = new Map(requests.map((item) => [item.id, item.status]));
    const data = await request("/api/payment-methods?requests=1");
    requests = data.requests;
    const settled = requests.filter((item) => before.get(item.id) === "pending" && item.status !== "pending");
    renderRequests();
    refreshCashable();
    if (settled.length) {
      const item = settled[0];
      if (item.status === "approved") {
        audio?.play("payment");
        showToast(item.kind === "deposit" ? `Deposit confirmed · ${dollars(item.creditedCents)} added` : `Cash out of ${dollars(item.amountCents)} sent`);
      } else {
        showToast(`${item.kind === "deposit" ? "Deposit" : "Cash out"} ${STATUS_LABELS[item.status].toLowerCase()}${item.adminNote ? `: ${item.adminNote}` : ""}`);
      }
      refreshWallet().catch(() => {});
    }
    scheduleRequestPoll();
  };

  requestList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cancel-request]");
    if (!button) return;
    button.disabled = true;
    try {
      await request("/api/payment-methods", { method: "POST", body: JSON.stringify({ action: "request_cancel", id: button.dataset.cancelRequest }) });
      showToast("Request cancelled");
      await loadRequests();
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
    }
  });
  document.getElementById("refresh-requests").addEventListener("click", () => {
    audio?.play("tap");
    Promise.all([loadRequests(), refreshWallet()]).catch((error) => showToast(error.message));
  });

  const submitRequest = async (button, payload, done) => {
    button.disabled = true;
    try {
      await request("/api/payment-methods", { method: "POST", body: JSON.stringify({ action: "request_create", ...payload }) });
      audio?.play("payment");
      done();
      await loadRequests();
      requestList.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
      refreshDepositSummary();
    }
  };

  depositButton.addEventListener("click", () => {
    if (!selectedMethod) return;
    submitRequest(depositButton, {
      kind: "deposit",
      amountCents: Math.round(selectedAmount * 100),
      methodName: selectedMethod.dataset.method,
      note: depositNote.value,
    }, () => {
      depositNote.value = "";
      showToast("Got it! We'll add your credits once the payment arrives.");
    });
  });

  cashoutButton.addEventListener("click", () => {
    const amountCents = toCents(cashoutAmount.value);
    if (!amountCents) {
      showToast("Enter an amount to cash out");
      cashoutAmount.focus();
      return;
    }
    if (amountCents > refreshCashable()) {
      showToast(`You can cash out up to ${dollars(refreshCashable())}`);
      return;
    }
    if (cashoutHandle.value.trim().length < 2) {
      showToast("Enter where you want to receive it");
      cashoutHandle.focus();
      return;
    }
    submitRequest(cashoutButton, {
      kind: "cashout",
      amountCents,
      methodName: cashoutMethod.value,
      paymentHandle: cashoutHandle.value,
    }, () => {
      cashoutAmount.value = "";
      showToast("Cash out requested. We'll let you know when it's sent.");
    });
  });

  window.addEventListener("gamish:view", (event) => {
    if (event.detail !== "payments" || !window.GamishAccount.player) return;
    Promise.all([refreshWallet(), loadPaymentMethods(), loadRequests()]).catch((error) => showToast(error.message));
  });
  refreshDepositSummary();

  // ---------- Messages ----------

  const messageList = document.getElementById("message-list");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const messageImageInput = document.getElementById("message-image-input");
  const messageImagePreview = document.getElementById("message-image-preview");
  const messageImagePreviewPhoto = document.getElementById("message-image-preview-photo");
  const messageImagePreviewName = document.getElementById("message-image-preview-name");
  const messageAttach = document.getElementById("message-attach");
  const unreadDot = document.getElementById("unread-dot");
  let pendingMessageImage = null;
  let chatMessages = [];
  let seenUntil = null;
  let chatLoaded = false;
  let chatTimer;
  let summaryTimer;
  chatImages?.setupViewer();

  const setPendingMessageImage = (attachment) => {
    pendingMessageImage = attachment;
    messageImagePreview.hidden = !attachment;
    if (attachment) {
      messageImagePreviewPhoto.src = attachment.previewUrl;
      messageImagePreviewName.textContent = attachment.name;
    } else {
      messageImagePreviewPhoto.removeAttribute("src");
      messageImageInput.value = "";
    }
  };

  const dayLabel = (value) => {
    const day = new Date(value);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (day.toDateString() === today.toDateString()) return "Today";
    if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
    return day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const renderMessages = () => {
    const nearBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 80;
    messageList.replaceChildren();
    if (!chatMessages.length) {
      const empty = document.createElement("p");
      empty.className = "message-empty";
      empty.textContent = "No messages yet. Say hello, we usually reply quickly.";
      messageList.append(empty);
      return;
    }
    const ownId = window.GamishAccount.player?.id;
    const seenTime = seenUntil ? new Date(seenUntil).getTime() : 0;
    const lastOwn = [...chatMessages].reverse().find((message) => message.senderId === ownId);
    let lastDay = "";
    let previous = null;
    for (const message of chatMessages) {
      const label = dayLabel(message.createdAt);
      if (label !== lastDay) {
        const divider = document.createElement("div");
        divider.className = "day-divider";
        divider.textContent = label;
        messageList.append(divider);
        lastDay = label;
      }
      const own = message.senderId === ownId;
      const next = chatMessages[chatMessages.indexOf(message) + 1];
      // Consecutive messages from one sender sit tight together, like a messaging app.
      const sameAsPrevious = previous && previous.senderId === message.senderId && label === lastDay
        && new Date(message.createdAt) - new Date(previous.createdAt) < 5 * 60_000;
      const endsGroup = !next || next.senderId !== message.senderId || dayLabel(next.createdAt) !== label
        || new Date(next.createdAt) - new Date(message.createdAt) >= 5 * 60_000;
      const row = document.createElement("div");
      const content = document.createElement("div");
      const bubble = document.createElement("div");
      const stamp = document.createElement("time");
      row.className = `message-row ${own ? "user-message" : "agent-message"}${message.pending ? " pending" : ""}${sameAsPrevious ? " grouped" : ""}`;
      if (!own) {
        const avatar = document.createElement("div");
        avatar.className = endsGroup ? "mini-avatar" : "mini-avatar spacer";
        avatar.textContent = endsGroup ? "G" : "";
        row.append(avatar);
      }
      bubble.className = "message-bubble";
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
      let stampText = new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      // Receipts on the latest own message only, like the messaging apps players know.
      if (own && message === lastOwn) {
        stampText += message.pending ? " · Sending…" : new Date(message.createdAt).getTime() <= seenTime ? " · Seen" : " · Sent";
      }
      stamp.className = "bubble-time";
      stamp.textContent = stampText;
      // The time rides inside the bubble, on the text's last line, so each message costs one line less.
      bubble.append(stamp);
      content.append(bubble);
      row.append(content);
      messageList.append(row);
      previous = message;
    }
    if (nearBottom || !chatLoaded) messageList.scrollTop = messageList.scrollHeight;
  };

  const setUnread = (count) => { unreadDot.hidden = !count || currentView === "messages"; };

  const loadMessages = async () => {
    if (!window.GamishAccount.player) return;
    const newest = chatMessages.filter((message) => !message.pending).at(-1)?.createdAt;
    const data = await request(newest && chatLoaded ? `/api/messages?after=${encodeURIComponent(newest)}` : "/api/messages");
    const known = new Set(chatMessages.map((message) => message.id));
    chatMessages = chatLoaded ? [...chatMessages, ...data.messages.filter((message) => !known.has(message.id))] : data.messages;
    if (data.messages.some((message) => message.senderId !== window.GamishAccount.player.id) && chatLoaded) audio?.play("reply");
    seenUntil = data.seenUntil;
    chatLoaded = true;
    setUnread(0);
    renderMessages();
  };

  const pollMessages = () => {
    window.clearTimeout(chatTimer);
    if (currentView !== "messages") return;
    chatTimer = window.setTimeout(() => loadMessages().catch(() => {}).finally(pollMessages), 5000);
  };

  const pollSummary = async () => {
    window.clearTimeout(summaryTimer);
    if (window.GamishAccount.player && currentView !== "messages" && document.visibilityState === "visible") {
      try {
        const data = await request("/api/messages?summary=1");
        setUnread(data.unreadCount);
      } catch { /* keep the last known badge */ }
    }
    summaryTimer = window.setTimeout(pollSummary, 25_000);
  };

  const sendMessage = async (text) => {
    const clean = text.trim();
    if (!clean && !pendingMessageImage) return;
    audio?.play("message");
    const attachment = pendingMessageImage ? {
      data: pendingMessageImage.data,
      type: pendingMessageImage.type,
      name: pendingMessageImage.name,
    } : null;
    // Show the message immediately; the server copy replaces it when the send completes.
    const optimistic = {
      id: `pending-${Date.now()}`,
      senderId: window.GamishAccount.player?.id,
      body: clean || "Photo",
      attachment: attachment ? { url: pendingMessageImage.previewUrl, name: attachment.name } : null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    chatMessages = [...chatMessages, optimistic];
    messageInput.value = "";
    setPendingMessageImage(null);
    messageList.scrollTop = messageList.scrollHeight;
    renderMessages();
    try {
      const data = await request("/api/messages", { method: "POST", body: JSON.stringify({ message: clean, attachment }) });
      chatMessages = chatMessages.map((message) => (message === optimistic ? data.message : message));
      renderMessages();
    } catch (error) {
      chatMessages = chatMessages.filter((message) => message !== optimistic);
      messageInput.value = clean;
      renderMessages();
      throw error;
    }
  };

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await sendMessage(messageInput.value); }
    catch (error) { showToast(error.message); }
  });

  // Quick replies wait behind the ⚡ button so they don't take a line from the conversation.
  const quickReplies = document.getElementById("quick-replies");
  const quickToggle = document.getElementById("quick-reply-toggle");
  const setQuickReplies = (open) => {
    quickReplies.hidden = !open;
    quickToggle.setAttribute("aria-expanded", String(open));
  };
  quickToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setQuickReplies(quickReplies.hidden);
  });
  document.addEventListener("click", (event) => {
    if (!quickReplies.hidden && !quickReplies.contains(event.target)) setQuickReplies(false);
  });
  document.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => {
      setQuickReplies(false);
      sendMessage(button.dataset.reply).catch((error) => showToast(error.message));
    });
  });

  // Support details live behind the header chip so the conversation gets the screen.
  const supportToggle = document.getElementById("support-info-toggle");
  const supportInfo = document.getElementById("support-info");
  const setSupportInfo = (open) => {
    supportInfo.hidden = !open;
    supportToggle.setAttribute("aria-expanded", String(open));
  };
  supportToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    audio?.play("tap");
    setSupportInfo(supportInfo.hidden);
  });
  document.addEventListener("click", (event) => {
    if (!supportInfo.hidden && !supportInfo.contains(event.target)) setSupportInfo(false);
  });

  messageAttach.addEventListener("click", () => {
    audio?.play("tap");
    messageImageInput.click();
  });
  messageImageInput.addEventListener("change", async () => {
    const [file] = messageImageInput.files;
    if (!file) return;
    messageAttach.disabled = true;
    try {
      showToast("Preparing image…");
      setPendingMessageImage(await chatImages.prepare(file));
      showToast("Image ready to send");
    } catch (error) {
      setPendingMessageImage(null);
      showToast(error.message);
    } finally {
      messageAttach.disabled = false;
    }
  });
  document.getElementById("message-image-remove").addEventListener("click", () => setPendingMessageImage(null));

  window.addEventListener("gamish:view", (event) => {
    if (event.detail === "messages") {
      setUnread(0);
      loadMessages().catch((error) => showToast(error.message)).finally(pollMessages);
    } else {
      window.clearTimeout(chatTimer);
      scheduleRequestPoll();
    }
  });

  // Start the background checks once someone is signed in.
  window.addEventListener("gamish:account", () => {
    chatMessages = [];
    chatLoaded = false;
    pollSummary();
    loadRequests().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollSummary();
  });

  // Installed on Android, the app can hold landscape itself; elsewhere the rotate prompt guides it.
  const lockLandscape = () => {
    try { window.screen?.orientation?.lock?.("landscape")?.catch?.(() => {}); } catch { /* not supported */ }
  };
  lockLandscape();
  window.addEventListener("pointerdown", lockLandscape, { once: true });

  // ---------- In-app back ----------
  // The phone's back button or gesture never leaves the app: a guard history entry turns it
  // into in-app navigation (close a popover, leave Wallet/Chat, leave a game for the lobby).
  const armBackGuard = () => {
    if (window.history.state?.gamish !== "guard") window.history.pushState({ gamish: "guard" }, "");
  };
  window.addEventListener("popstate", () => {
    if (!window.GamishAccount.player) return;
    if (!supportInfo.hidden) setSupportInfo(false);
    else if (!quickReplies.hidden) setQuickReplies(false);
    else if (currentView !== "arcade") showView("arcade");
    else window.dispatchEvent(new CustomEvent("gamish:back"));
    window.history.pushState({ gamish: "guard" }, "");
  });
  window.addEventListener("gamish:account", armBackGuard);
})();
