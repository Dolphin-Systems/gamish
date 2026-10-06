/*
 * Gamish game SDK — the only bridge between a game and the Gamish777 platform.
 *
 *   <script src="/platform/gamish-sdk.js"></script>
 *   const session = await Gamish.connect();     // { game, player, wallet, math, preview }
 *   const round = await Gamish.play({ bet: 10 }); // { roundId, outcome, multiplier, payout, value?, wallet }
 *   Gamish.onWallet((wallet) => …);             // balance changes
 *   Gamish.track("bonus_seen", { level: 2 });   // send information back to the server
 *
 * Inside the app a game runs in a sandboxed frame: it cannot see the player's session, cookies
 * or wallet API. The platform plays rounds on the server (central math and randomness) and
 * draws the one back button to the lobby. Opened on its own (/games/<id>/index.html) the SDK
 * runs a local preview with practice credits, using the game's own math.json, so a game can
 * be designed and tested without the server.
 */
(() => {
  "use strict";
  const VERSION = 1;
  const inHost = window.parent !== window;
  const walletListeners = new Set();
  const pending = new Map();
  let nextId = 1;
  let session = null;
  let preview = null;

  const emitWallet = (wallet) => {
    if (session) session.wallet = wallet;
    walletListeners.forEach((listener) => {
      try { listener(wallet); } catch (error) { console.error(error); }
    });
  };

  // ---------- Inside the app: talk to the host page ----------
  const ask = (type, payload = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ gamish: VERSION, id, type, payload }, "*");
  });

  window.addEventListener("message", (event) => {
    if (!inHost || event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.gamish !== VERSION) return;
    if (message.reply) {
      const waiting = pending.get(message.reply);
      if (!waiting) return;
      pending.delete(message.reply);
      if (message.ok) waiting.resolve(message.data);
      else waiting.reject(Object.assign(new Error(message.error?.message || "Something went wrong"), { code: message.error?.code }));
    } else if (message.type === "wallet") {
      emitWallet(message.wallet);
    }
  });

  // ---------- On its own: a local preview with practice credits ----------
  const startPreview = async () => {
    const math = await fetch("math.json").then((response) => response.json());
    const game = await fetch("game.json").then((response) => response.json()).catch(() => ({ id: "preview", title: document.title }));
    const credits = 10_000;
    preview = { math, wallet: { regularCredits: credits, bonusCredits: 0, totalCredits: credits } };
    console.info("[Gamish] Preview mode: practice credits and local randomness. Inside the app the server decides rounds.");
    const publicMath = math.model === "weighted"
      ? { model: math.model, bets: math.bets, outcomes: math.outcomes.map(({ id, multiplier }) => ({ id, multiplier })) }
      : { model: math.model, bets: math.bets, targets: math.targets };
    return { game: { id: game.id, title: game.title, version: game.version }, player: { loginId: "Preview" }, wallet: preview.wallet, math: publicMath, preview: true };
  };

  const previewRound = ({ bet, target }) => {
    const { math, wallet } = preview;
    if (!math.bets.includes(bet)) throw Object.assign(new Error("Invalid bet"), { code: "invalid_bet" });
    if (wallet.totalCredits < bet) throw Object.assign(new Error("Not enough credits"), { code: "insufficient_credits" });
    let outcome;
    let multiplier;
    let value;
    if (math.model === "weighted") {
      const total = math.outcomes.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.floor(Math.random() * total);
      const hit = math.outcomes.find((item) => (roll -= item.weight) < 0);
      ({ id: outcome, multiplier } = hit);
    } else {
      if (!math.targets.includes(target)) throw Object.assign(new Error("Choose one of the game's targets"), { code: "invalid_target" });
      value = Math.max(1, Math.floor((math.rtp / (1 - Math.random())) * 100) / 100);
      outcome = value >= target ? "win" : "lose";
      multiplier = outcome === "win" ? target : 0;
    }
    const payout = Math.round(bet * multiplier);
    const total = wallet.totalCredits - bet + payout;
    preview.wallet = { regularCredits: total, bonusCredits: 0, totalCredits: total };
    emitWallet(preview.wallet);
    return { roundId: `preview-${Date.now()}`, gameId: session?.game.id, bet, outcome, multiplier, payout, value, wallet: preview.wallet };
  };

  // ---------- Public API ----------
  let connecting = null;
  window.Gamish = Object.freeze({
    version: VERSION,
    connect() {
      connecting ??= (inHost ? ask("connect") : startPreview()).then((data) => {
        session = { ...data, preview: !inHost };
        return session;
      });
      return connecting;
    },
    async play({ bet, target } = {}) {
      if (!session) await this.connect();
      const request = { bet: Number(bet), ...(target === undefined ? {} : { target: Number(target) }) };
      const round = inHost ? await ask("play", request) : previewRound(request);
      if (inHost) emitWallet(round.wallet);
      return round;
    },
    get wallet() {
      return session?.wallet ?? null;
    },
    onWallet(listener) {
      walletListeners.add(listener);
      return () => walletListeners.delete(listener);
    },
    track(name, data = {}) {
      if (inHost) ask("event", { name: String(name).slice(0, 40), data }).catch(() => {});
      else console.info("[Gamish] track", name, data);
    },
    exit() {
      if (inHost) ask("exit").catch(() => {});
    },
  });
})();
