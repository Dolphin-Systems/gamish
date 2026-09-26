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

  const setWallet = (player) => {
    if (!player) return;
    walletBalance.textContent = `${Number(player.totalCredits || 0).toLocaleString("en-US")} CR`;
    walletPlayerId.textContent = player.loginId;
    accountInitial.textContent = player.loginId.charAt(0).toUpperCase();
  };

  const applyPlayer = (player) => {
    window.GamishAccount.player = player;
    setWallet(player);
    loginView.classList.add("hidden");
    app.classList.remove("account-locked");
    app.setAttribute("aria-hidden", "false");
    window.dispatchEvent(new CustomEvent("gamish:account", { detail: player }));
  };

  const lockApp = () => {
    window.GamishAccount.player = null;
    loginView.classList.remove("hidden");
    app.classList.add("account-locked");
    app.setAttribute("aria-hidden", "true");
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
      button.textContent = "Enter the arcade";
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
    if (name === "messages") document.querySelector(".unread-dot")?.remove();
    if (name === "payments" && window.GamishAccount.player) {
      Promise.all([refreshWallet(), loadPaymentMethods()]).catch((error) => showToast(error.message));
    }
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

  const amountButtons = [...document.querySelectorAll(".amount-chip")];
  const customAmount = document.getElementById("custom-amount");
  const amountLabel = document.getElementById("amount-label");
  const reviewButton = document.getElementById("review-reload");
  let selectedAmount = 5;
  let selectedBonus = 0;

  const updateAmount = (amount, source, bonus = 0) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    selectedAmount = Math.min(parsed, 9999);
    selectedBonus = Math.max(0, Number(bonus) || 0);
    amountButtons.forEach((button) => button.classList.toggle("selected", button === source));
    const formattedAmount = selectedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 });
    amountLabel.textContent = selectedBonus ? `$${formattedAmount} + $${selectedBonus} bonus` : `$${formattedAmount} selected`;
    reviewButton.querySelector("span").textContent = `Refresh $${formattedAmount} payment status`;
  };

  amountButtons.forEach((button) => button.addEventListener("click", () => {
    audio?.play("tap");
    customAmount.value = button.dataset.amount;
    updateAmount(button.dataset.amount, button, button.dataset.bonus);
  }));

  customAmount.addEventListener("input", () => updateAmount(customAmount.value, null, 0));

  const methodGrid = document.getElementById("payment-method-grid");
  const methodLabel = document.querySelector(".methods-panel .selection-label");
  let methodCards = [];
  let selectedMethod = null;

  const selectMethod = (card) => {
    selectedMethod = card;
    methodCards.forEach((item) => item.classList.toggle("selected", item === card));
    methodLabel.textContent = `${card.dataset.method} selected`;
  };

  const paymentTone = (name) => {
    const normalized = name.toLowerCase();
    if (normalized.includes("cash")) return "cash";
    if (normalized.includes("chime")) return "chime";
    if (normalized.includes("paypal")) return "paypal";
    if (normalized.includes("venmo")) return "venmo";
    return "custom";
  };

  const renderPaymentMethods = (methods) => {
    methodGrid.replaceChildren();
    selectedMethod = null;
    if (!methods.length) {
      const empty = document.createElement("p");
      empty.className = "payment-method-empty";
      empty.textContent = "Payment methods are being updated. Please check again shortly.";
      methodGrid.append(empty);
      methodLabel.textContent = "No methods available";
      methodCards = [];
      return;
    }
    methodCards = methods.map((method) => {
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
    selectMethod(methodCards[0]);
  };

  const loadPaymentMethods = async () => {
    const data = await request("/api/payment-methods");
    renderPaymentMethods(data.methods);
  };

  reviewButton.addEventListener("click", async () => {
    audio?.play("payment");
    reviewButton.disabled = true;
    try {
      const player = await refreshWallet();
      showToast(`Wallet refreshed • ${player.totalCredits.toLocaleString("en-US")} credits`);
    } catch (error) {
      showToast(error.message);
    } finally {
      reviewButton.disabled = false;
    }
  });

  const messageList = document.getElementById("message-list");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const messageImageInput = document.getElementById("message-image-input");
  const messageImagePreview = document.getElementById("message-image-preview");
  const messageImagePreviewPhoto = document.getElementById("message-image-preview-photo");
  const messageImagePreviewName = document.getElementById("message-image-preview-name");
  const messageAttach = document.getElementById("message-attach");
  let pendingMessageImage = null;
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

  const renderMessages = (messages) => {
    messageList.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "message-empty";
      empty.textContent = "No messages yet. Say hello to the admin team.";
      messageList.append(empty);
      return;
    }
    for (const message of messages) {
      const own = message.senderId === window.GamishAccount.player?.id;
      const row = document.createElement("div");
      const content = document.createElement("div");
      const bubble = document.createElement("div");
      const stamp = document.createElement("time");
      row.className = `message-row ${own ? "user-message" : "agent-message"}`;
      if (!own) {
        const avatar = document.createElement("div");
        avatar.className = "mini-avatar";
        avatar.textContent = "G";
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
      stamp.textContent = new Date(message.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      content.append(bubble, stamp);
      row.append(content);
      messageList.append(row);
    }
    messageList.scrollTop = messageList.scrollHeight;
  };

  const loadMessages = async () => {
    if (!window.GamishAccount.player) return;
    const data = await request("/api/messages");
    renderMessages(data.messages);
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
    await request("/api/messages", { method: "POST", body: JSON.stringify({ message: clean, attachment }) });
    messageInput.value = "";
    setPendingMessageImage(null);
    await loadMessages();
  };

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = messageForm.querySelector(".send-button");
    button.disabled = true;
    try { await sendMessage(messageInput.value); }
    catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });

  document.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.reply).catch((error) => showToast(error.message)));
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

  document.querySelector('[data-view="messages"]').addEventListener("click", () => loadMessages().catch((error) => showToast(error.message)));
  window.setInterval(() => {
    if (document.getElementById("messages-view").classList.contains("active")) loadMessages().catch(() => {});
  }, 10000);
})();
