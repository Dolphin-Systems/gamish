(() => {
  const GATE_ORDER = ["miss", "ember", "gem", "hoard", "dragon"];
  const GATE_DISPLAY = {
    miss: "ASH", ember: "EMBER", gem: "GEM", hoard: "HOARD", dragon: "DRAGON"
  };
  let audio;
  function sound() {
    if (audio) return audio;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audio = new Context();
    return audio;
  }
  function tone(frequency, duration, type = "sine", volume = .04, glide) {
    const context = sound(); if (!context) return;
    const oscillator = context.createOscillator(); const gain = context.createGain(); const now = context.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(glide, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + duration + .03);
  }
  function playDropSound() { tone(310, .16, "triangle", .035, 720); setTimeout(() => tone(620, .15, "sine", .025, 1200), 160); }
  function playHitSound(winner) { tone(winner ? 520 : 160, .12, winner ? "triangle" : "sawtooth", .05, winner ? 1050 : 100); if (winner) setTimeout(() => tone(780, .42, "sine", .045, 1320), 100); }

  (async () => {
    const session = await Gamish.connect();
    const { bets, outcomes } = session.math;
    const balance = document.getElementById("balance"); const gates = document.getElementById("gates");
    const play = document.getElementById("play"); const betRow = document.getElementById("bets");
    const result = document.getElementById("result"); const status = document.getElementById("status-label");
    const statusCard = document.querySelector(".status-card"); const orb = document.getElementById("orb");
    const impact = document.getElementById("impact"); const soundButton = document.getElementById("sound");
    let bet = bets[0]; let running = false;
    const money = (amount) => `$${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const showWallet = (wallet) => { balance.textContent = money(wallet.totalCredits); };
    showWallet(session.wallet); Gamish.onWallet(showWallet);

    const gateById = new Map();
    GATE_ORDER.forEach((id, index) => {
      const gate = document.createElement("div"); gate.className = "gate"; gate.dataset.gate = id;
      gate.innerHTML = `<span class="gem"></span><b>${GATE_DISPLAY[id]}</b>`;
      gates.append(gate); gateById.set(id, { gate, index });
    });
    bets.forEach((amount) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "bet"; button.textContent = `$${amount}`;
      button.classList.toggle("on", amount === bet);
      button.addEventListener("click", () => { if (running) return; bet = amount; betRow.querySelectorAll("button").forEach((item) => item.classList.toggle("on", item === button)); });
      betRow.append(button);
    });
    function clearVisuals() {
      gateById.forEach(({ gate }) => gate.classList.remove("winner")); orb.classList.remove("dropping", "hit"); impact.classList.remove("show"); statusCard.classList.remove("win", "lose");
      orb.style.removeProperty("--lane-x"); orb.style.removeProperty("--land-y");
    }
    function lock(value) { play.disabled = value; betRow.querySelectorAll("button").forEach((button) => { button.disabled = value; }); }
    function laneFor(outcomeId) {
      const resolved = gateById.has(outcomeId) ? outcomeId : (outcomeId === "win" ? "gem" : outcomeId === "big-win" ? "dragon" : "miss");
      return { id: resolved, ...gateById.get(resolved) };
    }
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    function reveal(round) {
      const lane = laneFor(round.outcome); const horizontal = (lane.index / (GATE_ORDER.length - 1) - .5) * 2;
      const playfield = document.querySelector(".playfield"); const landY = Math.max(92, playfield.clientHeight - 112);
      orb.style.setProperty("--lane-x", `${horizontal * 154}px`); orb.style.setProperty("--land-y", `${landY}px`); orb.classList.add("dropping"); playDropSound();
      setTimeout(() => {
        const gateRect = lane.gate.getBoundingClientRect(); const fieldRect = playfield.getBoundingClientRect();
        orb.classList.remove("dropping"); orb.classList.add("hit"); lane.gate.classList.add("winner");
        impact.style.setProperty("--impact-x", `${gateRect.left - fieldRect.left + gateRect.width / 2}px`); impact.style.setProperty("--impact-y", `${gateRect.top - fieldRect.top + 6}px`); impact.classList.add("show");
      }, 1450);
    }
    function describe(round) { const outcome = outcomes.find((item) => item.id === round.outcome); const multiplier = outcome?.multiplier ?? round.multiplier; return round.payout > 0 ? `${money(round.payout)} WON  /  ${multiplier}X` : "THE EMBER FELL TO ASH"; }
    soundButton.addEventListener("click", async () => { const context = sound(); if (!context) return; await context.resume(); soundButton.classList.toggle("active", context.state === "running"); tone(700, .1, "sine", .03, 980); });
    play.addEventListener("click", async () => {
      if (running) return; running = true; lock(true); clearVisuals(); status.textContent = "DRAGON IS AIMING"; result.textContent = "The ember is gathering...";
      try {
        const context = sound(); if (context?.state === "suspended") await context.resume();
        const round = await Gamish.play({ bet });
        status.textContent = "EMBER DROPPING"; reveal(round); await wait(1620);
        const winner = round.payout > 0; status.textContent = winner ? "TREASURE CLAIMED" : "TRY ANOTHER DROP"; result.textContent = describe(round); statusCard.classList.add(winner ? "win" : "lose"); playHitSound(winner);
        Gamish.track("round_shown", { outcome: round.outcome, multiplier: round.multiplier });
      } catch (error) {
        status.textContent = error.code === "insufficient_credits" ? "LOW WALLET" : "DROP INTERRUPTED"; result.textContent = error.code === "insufficient_credits" ? "Not enough credits for this stake" : "Please try again"; statusCard.classList.add("lose");
      } finally { running = false; lock(false); }
    });
  })();
})();
