(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    cards: $("cards"), chips: $("chips"), balance: $("balance"), stake: $("stake"), ignite: $("ignite"),
    payout: $("payout"), message: $("message"),
  };
  const cards = [...document.querySelectorAll(".scratch-card")];
  let session = null;
  let bets = [];
  let betIndex = 0;
  let wallet = 0;
  let busy = false;

  const fmt = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const say = (text, error = false) => { ui.message.textContent = text; ui.message.classList.toggle("error", error); };
  const bet = () => bets[betIndex];

  function clickSound(tone = 420, duration = .07) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = window.__emberScratchAudio || (window.__emberScratchAudio = new AudioCtx());
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.setValueAtTime(tone, ctx.currentTime); gain.gain.setValueAtTime(.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }

  function showWallet(next) {
    if (!next) return;
    wallet = Number(next.totalCredits) || 0;
    ui.balance.textContent = fmt(wallet);
  }

  function renderChips() {
    ui.chips.replaceChildren(...bets.map((value, index) => {
      const chip = document.createElement("button");
      chip.type = "button"; chip.textContent = fmt(value); chip.classList.toggle("selected", index === betIndex);
      chip.disabled = busy;
      chip.addEventListener("click", () => { if (!busy) { betIndex = index; clickSound(360); sync(); } });
      return chip;
    }));
  }

  function sync() {
    ui.stake.textContent = bets.length ? fmt(bet()) : "—";
    ui.ignite.disabled = busy || !session;
    renderChips();
  }

  function resetCards() {
    cards.forEach((card) => {
      card.classList.remove("reveal", "win");
      const foil = card.querySelector(".foil");
      foil.style.animation = "none";
      void foil.offsetWidth;
      foil.style.animation = "";
      card.querySelector(".face-icon").textContent = "✦";
      card.querySelector("b").textContent = "";
      card.querySelector("small").textContent = "";
    });
  }

  const displays = {
    miss: ["ASH", "ASH", "EMBER"], spark: ["SPARK", "EMBER", "SPARK"], flame: ["FLAME", "FLAME", "FLAME"],
    crown: ["CROWN", "CROWN", "CROWN"], inferno: ["INFERNO", "INFERNO", "INFERNO"],
  };
  const icons = { miss: "✦", spark: "✧", flame: "♨", crown: "♛", inferno: "☀" };

  async function reveal(round) {
    const words = displays[round.outcome] || displays.miss;
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      card.querySelector(".face-icon").textContent = icons[round.outcome] || "✦";
      card.querySelector("b").textContent = words[i];
      card.querySelector("small").textContent = round.multiplier > 0 ? `${fmt(round.multiplier)}× PRIZE` : "NO PRIZE";
      card.classList.add("reveal");
      clickSound(310 + i * 95, .09);
      await sleep(260);
    }
    if (Number(round.multiplier) > 0) cards.forEach((card) => card.classList.add("win"));
  }

  async function ignite() {
    if (busy || !session) return;
    if (bet() > wallet) { say("Insufficient credits for this stake.", true); return; }
    busy = true; ui.payout.textContent = "0"; resetCards(); say("The embers are waking…"); sync(); clickSound(220, .13);
    let round;
    try {
      round = await Gamish.play({ bet: bet() });
    } catch (error) {
      busy = false;
      say(error?.code === "insufficient_credits" ? "Insufficient credits for this stake." : "Could not start that round. Try again.", true);
      sync();
      return;
    }
    await reveal(round);
    ui.payout.textContent = fmt(round.payout);
    if (Number(round.multiplier) > 0) {
      say(`${round.outcome.toUpperCase()} — ${fmt(round.multiplier)}× pays ${fmt(round.payout)}.`);
      clickSound(round.multiplier >= 5 ? 880 : 650, .24);
    } else say("Ash this time. The next card may burn brighter.");
    Gamish.track("round_shown", { outcome: round.outcome, multiplier: round.multiplier });
    busy = false; sync();
  }

  ui.ignite.addEventListener("click", ignite);
  resetCards(); sync();
  (async () => {
    try {
      session = await Gamish.connect();
      bets = session.math.bets.slice();
      showWallet(session.wallet);
      Gamish.onWallet(showWallet);
      say(session.preview ? "Preview mode — choose a stake and ignite." : "Choose a stake and ignite all three cards.");
    } catch {
      say("Could not connect — please reopen the game.", true);
    }
    sync();
  })();
})();
