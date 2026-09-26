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
    const credited = selectedAmount + selectedBonus;
    reviewButton.querySelector("span").textContent = selectedBonus
      ? `Continue with $${formattedAmount} • get $${credited.toLocaleString("en-US")}`
      : `Continue with $${formattedAmount}`;
  };

  amountButtons.forEach((button) => button.addEventListener("click", () => {
    audio?.play("tap");
    customAmount.value = button.dataset.amount;
    updateAmount(button.dataset.amount, button, button.dataset.bonus);
  }));

  customAmount.addEventListener("input", () => updateAmount(customAmount.value, null, 0));

  const methodCards = [...document.querySelectorAll(".method-card")];
  const methodLabel = document.querySelector(".methods-panel .selection-label");
  let selectedMethod = methodCards[0];

  const selectMethod = (card) => {
    selectedMethod = card;
    methodCards.forEach((item) => item.classList.toggle("selected", item === card));
    methodLabel.textContent = `${card.dataset.method} selected`;
  };

  methodCards.forEach((card) => card.addEventListener("click", () => {
    audio?.play("tap");
    selectMethod(card);
  }));

  reviewButton.addEventListener("click", () => {
    audio?.play("payment");
    const bonusCopy = selectedBonus ? ` + $${selectedBonus} bonus` : "";
    showToast(`Demo ready: $${selectedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}${bonusCopy} via ${selectedMethod.dataset.method}`);
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
    if (message.includes("reload") || message.includes("wallet")) return "Open the wallet icon above, enter an amount, choose a method, then continue. This preview won’t submit real money.";
    if (message.includes("game")) return "Phoenix Ruby is playable now, with three more worlds waiting in the Game Zone.";
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
