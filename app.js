(() => {
  "use strict";

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
  let selectedAmount = 25;

  const updateAmount = (amount, source) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    selectedAmount = Math.min(parsed, 9999);
    amountButtons.forEach((button) => button.classList.toggle("selected", button === source));
    amountLabel.textContent = `$${selectedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} selected`;
    reviewButton.querySelector("span").textContent = `Review $${selectedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} reload`;
  };

  amountButtons.forEach((button) => button.addEventListener("click", () => {
    audio?.play("tap");
    customAmount.value = "";
    updateAmount(button.dataset.amount, button);
  }));

  customAmount.addEventListener("input", () => updateAmount(customAmount.value, null));

  const methodCards = [...document.querySelectorAll(".method-card")];
  const methodDetail = document.getElementById("method-detail");
  const methodHandle = document.getElementById("method-handle");
  const detailKicker = document.querySelector(".detail-kicker");
  let selectedMethod = methodCards[0];

  const selectMethod = (card) => {
    selectedMethod = card;
    methodCards.forEach((item) => item.classList.toggle("selected", item === card));
    methodDetail.dataset.tone = card.dataset.tone;
    methodHandle.textContent = card.dataset.handle;
    detailKicker.textContent = `SEND WITH ${card.dataset.method.toUpperCase()}`;
  };

  methodCards.forEach((card) => card.addEventListener("click", () => {
    audio?.play("tap");
    selectMethod(card);
  }));

  document.getElementById("copy-handle").addEventListener("click", async (event) => {
    audio?.play("payment");
    try {
      await navigator.clipboard.writeText(selectedMethod.dataset.handle);
      event.currentTarget.textContent = "Copied ✓";
      showToast(`${selectedMethod.dataset.method} handle copied`);
    } catch {
      showToast(`Copy this handle: ${selectedMethod.dataset.handle}`);
    }
    window.setTimeout(() => { event.currentTarget.textContent = "Copy"; }, 1500);
  });

  reviewButton.addEventListener("click", () => {
    audio?.play("payment");
    showToast(`Demo ready: $${selectedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} via ${selectedMethod.dataset.method}`);
  });

  const messageList = document.getElementById("message-list");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");

  const timeLabel = () => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());

  const addUserMessage = (text) => {
    const row = document.createElement("div");
    row.className = "message-row user-message";
    const content = document.createElement("div");
    const bubble = document.createElement("div");
    const time = document.createElement("time");
    bubble.className = "message-bubble";
    bubble.textContent = text;
    time.textContent = timeLabel();
    content.append(bubble, time);
    row.append(content);
    messageList.append(row);
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
  };

  const addAgentMessage = (text) => {
    const row = document.createElement("div");
    row.className = "message-row agent-message";
    const avatar = document.createElement("div");
    const content = document.createElement("div");
    const bubble = document.createElement("div");
    const time = document.createElement("time");
    avatar.className = "mini-avatar";
    avatar.textContent = "M";
    bubble.className = "message-bubble";
    bubble.textContent = text;
    time.textContent = timeLabel();
    content.append(bubble, time);
    row.append(avatar, content);
    messageList.append(row);
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
  };

  const addTyping = () => {
    const row = document.createElement("div");
    row.className = "message-row agent-message typing-row";
    const avatar = document.createElement("div");
    const bubble = document.createElement("div");
    avatar.className = "mini-avatar";
    avatar.textContent = "M";
    bubble.className = "message-bubble typing-bubble";
    bubble.innerHTML = "<i></i><i></i><i></i>";
    row.append(avatar, bubble);
    messageList.append(row);
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
    return row;
  };

  const replyFor = (text) => {
    const message = text.toLowerCase();
    if (message.includes("reload") || message.includes("wallet")) return "Open Payments below, choose an amount and method, then review the reload. This preview won’t submit real money.";
    if (message.includes("game")) return "Four original game worlds are in the Game Zone now. The playable portals are the next phase of development.";
    if (message.includes("payment")) return "I can help. The redesigned Payments page shows the selected method and handle clearly before any next step.";
    return "Thanks — I’ve got your message. This demo keeps the conversation here so the support flow feels clear and familiar.";
  };

  const sendMessage = (text) => {
    const clean = text.trim();
    if (!clean) return;
    audio?.play("message");
    addUserMessage(clean);
    messageInput.value = "";
    const typing = addTyping();
    window.setTimeout(() => {
      typing.remove();
      addAgentMessage(replyFor(clean));
      audio?.play("reply");
    }, 900);
  };

  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(messageInput.value);
  });

  document.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.reply));
  });

  document.querySelector(".attach-button").addEventListener("click", () => {
    audio?.play("tap");
    showToast("Screenshot attachments are available in the connected support build");
  });
})();
