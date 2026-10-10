(() => {
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const numberEl = document.getElementById("numbers");
  const betEl = document.getElementById("bets");
  const play = document.getElementById("play");
  const status = document.getElementById("status");
  const balance = document.getElementById("balance");
  const lastWin = document.getElementById("last-win");
  const roundCount = document.getElementById("round-count");
  const drawEl = document.getElementById("draws");
  const overlay = document.getElementById("win-overlay");
  const winKicker = document.getElementById("win-kicker");
  const winAmount = document.getElementById("win-amount");
  const winDetail = document.getElementById("win-detail");
  const numberButtons = [];
  let selected = 7;
  let bet = 10;
  let busy = false;
  let roundNumber = 1;
  let audio;

  const money = (amount) => `$${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const updateWallet = (wallet) => { balance.textContent = money(wallet.totalCredits); };

  function ensureAudio() {
    if (audio) return audio;
    audio = new (window.AudioContext || window.webkitAudioContext)();
    return audio;
  }

  function tone(frequency, length, type = "sine", gain = 0.035) {
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    volume.gain.setValueAtTime(gain, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + length);
  }

  function setControlsDisabled(disabled) {
    play.disabled = disabled;
    numberButtons.forEach((button) => { button.disabled = disabled; });
    betEl.querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
  }

  function randomOther(excluded) {
    const candidates = Array.from({ length: 10 }, (_, index) => index + 1).filter((number) => number !== excluded);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function drawValues(outcome) {
    const matches = { miss: 0, spark: 1, double: 2, prism: 3 }[outcome] ?? 0;
    const values = Array.from({ length: matches }, () => selected);
    while (values.length < 3) values.push(randomOther(selected));
    return values.sort(() => Math.random() - .5);
  }

  function resetDraws() {
    drawEl.replaceChildren(...Array.from({ length: 3 }, () => {
      const orb = document.createElement("div");
      orb.className = "draw-orb waiting";
      orb.textContent = "?";
      return orb;
    }));
  }

  async function reveal(round) {
    const values = drawValues(round.outcome);
    const orbs = [...drawEl.children];
    for (let index = 0; index < values.length; index += 1) {
      await delay(300);
      const orb = orbs[index];
      orb.className = "draw-orb revealing";
      orb.textContent = values[index];
      if (values[index] === selected) orb.classList.add("match");
      tone(values[index] === selected ? 680 : 350, .16, "triangle", values[index] === selected ? .07 : .035);
    }
  }

  function showWin(round) {
    if (!round.payout) return;
    const messages = {
      spark: ["SPARK MATCH", "One crystal answered your call."],
      double: ["DOUBLE CRYSTAL", "Two bright crystals aligned."],
      prism: ["PRISM JACKPOT", "All three crystals aligned."],
    };
    const [kicker, detail] = messages[round.outcome] || ["CRYSTAL MATCH", "A bright little win."];
    winKicker.textContent = kicker;
    winAmount.textContent = money(round.payout);
    winDetail.textContent = detail;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    tone(round.outcome === "prism" ? 880 : 640, .35, "sine", .08);
    setTimeout(() => {
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
    }, 1800);
  }

  async function init() {
    const session = await Gamish.connect();
    const { bets } = session.math;
    bet = bets[0];
    updateWallet(session.wallet);
    Gamish.onWallet(updateWallet);

    Array.from({ length: 10 }, (_, index) => index + 1).forEach((number) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number";
      button.textContent = number;
      button.setAttribute("aria-label", `Choose crystal ${number}`);
      button.classList.toggle("selected", number === selected);
      button.addEventListener("click", () => {
        if (busy) return;
        selected = number;
        numberButtons.forEach((item) => item.classList.toggle("selected", item === button));
        status.textContent = `Crystal ${selected} is ready for the draw.`;
        ensureAudio().resume();
        tone(480, .08, "sine");
      });
      numberButtons.push(button);
      numberEl.append(button);
    });

    bets.forEach((amount) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = money(amount).replace(".00", "");
      button.classList.toggle("on", amount === bet);
      button.addEventListener("click", () => {
        if (busy) return;
        bet = amount;
        betEl.querySelectorAll("button").forEach((item) => item.classList.toggle("on", item === button));
        ensureAudio().resume();
        tone(410, .08, "sine");
      });
      betEl.append(button);
    });

    play.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      setControlsDisabled(true);
      ensureAudio().resume();
      tone(260, .12, "triangle", .05);
      resetDraws();
      status.textContent = "The crystal chamber is drawing...";
      try {
        const round = await Gamish.play({ bet });
        await delay(260);
        await reveal(round);
        if (round.payout > 0) {
          lastWin.textContent = money(round.payout);
          status.textContent = `${round.multiplier}x crystal reward unlocked.`;
        } else {
          lastWin.textContent = money(0);
          status.textContent = "No match this round. Choose again and draw.";
          tone(170, .22, "sine", .025);
        }
        showWin(round);
        Gamish.track("round_shown", { outcome: round.outcome });
        roundNumber += 1;
        roundCount.textContent = String(roundNumber).padStart(2, "0");
      } catch (error) {
        status.textContent = error.code === "insufficient_credits" ? "Your balance needs a little more light." : "The chamber could not complete that draw.";
      } finally {
        busy = false;
        setControlsDisabled(false);
      }
    });
  }

  init();
})();
