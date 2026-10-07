// Lucky Wheel. The server picks the outcome (games/lucky-wheel/math.json, drawn by the central
// engine); this file only spins the wheel to a segment that shows that outcome.
(async () => {
  "use strict";
  const session = await Gamish.connect();
  const { bets, outcomes } = session.math;
  const multiplierOf = Object.fromEntries(outcomes.map((item) => [item.id, item.multiplier]));

  // The wheel's face: which outcome each of its 16 segments shows. Purely visual; the odds are
  // set by the weights on the server, not by how many segments a prize has.
  const SEGMENTS = ["x10", "miss", "x1-5", "half", "x2", "miss", "x5", "half", "x1-5", "miss", "x2", "half", "x5", "miss", "x1-5", "x2"];
  const STYLE = {
    "x10": { fill: ["#ffe9a8", "#e7a12f"], ink: "#3a1204", label: "10×" },
    "x5": { fill: ["#ff8a6a", "#c2331b"], ink: "#fff3dc", label: "5×" },
    "x2": { fill: ["#b783ff", "#6a2fbf"], ink: "#fff3dc", label: "2×" },
    "x1-5": { fill: ["#5fe3d8", "#1d8f93"], ink: "#062b2b", label: "1.5×" },
    "half": { fill: ["#4a2a4c", "#2a1530"], ink: "#e9d0e0", label: "½×" },
    "miss": { fill: ["#24121f", "#150a13"], ink: "#8f7584", label: "✦" },
  };

  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const spinButton = document.getElementById("spin");
  const message = document.getElementById("message");
  const balance = document.getElementById("balance");
  const history = document.getElementById("history");
  document.getElementById("preview").hidden = !session.preview;

  let angle = 0; // radians; segment 0 starts at the pointer
  let spinning = false;
  let bet = bets[0];
  const step = (Math.PI * 2) / SEGMENTS.length;

  // ---------- Drawing ----------
  let size = 0;
  const resize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    size = Math.round(canvas.clientWidth * ratio);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    draw();
  };
  const draw = () => {
    const c = size / 2;
    const r = c * 0.96;
    ctx.clearRect(0, 0, size, size);
    // Rim with studs.
    const rim = ctx.createLinearGradient(0, 0, 0, size);
    rim.addColorStop(0, "#fff0b8");
    rim.addColorStop(0.5, "#d98e27");
    rim.addColorStop(1, "#6e340c");
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();
    const face = r * 0.9;
    SEGMENTS.forEach((id, index) => {
      const start = angle + index * step - Math.PI / 2 - step / 2;
      const style = STYLE[id];
      const gradient = ctx.createRadialGradient(c, c, face * 0.2, c, c, face);
      gradient.addColorStop(0, style.fill[0]);
      gradient.addColorStop(1, style.fill[1]);
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, face, start, start + step);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 220, 150, 0.35)";
      ctx.lineWidth = size * 0.004;
      ctx.stroke();
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(start + step / 2);
      ctx.fillStyle = style.ink;
      ctx.font = `800 ${Math.round(face * (id === "x10" ? 0.13 : 0.11))}px "DM Sans", sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(style.label, face * 0.9, 0);
      ctx.restore();
    });
    for (let i = 0; i < SEGMENTS.length; i += 1) {
      const a = angle + i * step - Math.PI / 2 - step / 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95, size * 0.011, 0, Math.PI * 2);
      ctx.fillStyle = "#fff7da";
      ctx.fill();
    }
  };
  window.addEventListener("resize", resize);
  resize();

  // ---------- Sound: a soft tick per segment, a chord on wins ----------
  let audio = null;
  const tone = (frequency, duration, gain = 0.05) => {
    if (!Gamish.sound) return; // the platform's sound switch
    try {
      audio ??= new AudioContext();
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(volume).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch { /* no audio */ }
  };

  // ---------- Celebration ----------
  const fx = document.getElementById("fx");
  const fxCtx = fx.getContext("2d");
  const burst = (count) => {
    fx.width = window.innerWidth;
    fx.height = window.innerHeight;
    const colors = ["#ffd257", "#ff8a3d", "#fff3c4", "#b783ff", "#5fe3d8"];
    const origin = canvas.getBoundingClientRect();
    const pieces = Array.from({ length: count }, () => ({
      x: origin.left + origin.width / 2, y: origin.top + origin.height / 2,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3, r: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)], life: 1,
    }));
    const tick = () => {
      fxCtx.clearRect(0, 0, fx.width, fx.height);
      let alive = false;
      pieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life -= 0.012;
        if (p.life <= 0) return;
        alive = true;
        fxCtx.globalAlpha = p.life;
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(p.x, p.y, p.r, p.r * 1.6);
      });
      fxCtx.globalAlpha = 1;
      if (alive) requestAnimationFrame(tick);
    };
    tick();
  };

  // ---------- UI ----------
  const showWallet = (wallet) => { balance.textContent = wallet.totalCredits.toLocaleString("en-US"); };
  showWallet(session.wallet);
  Gamish.onWallet(showWallet);

  const betRow = document.getElementById("bets");
  const betButtons = bets.map((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gamish-frame";
    button.textContent = amount;
    button.classList.toggle("on", amount === bet);
    button.addEventListener("click", () => {
      if (spinning) return;
      bet = amount;
      betButtons.forEach((item) => item.classList.toggle("on", item === button));
      tone(660, 0.06, 0.03);
    });
    betRow.append(button);
    return button;
  });

  const addHistory = (round) => {
    const item = document.createElement("li");
    item.textContent = round.multiplier ? `${round.multiplier}×` : "—";
    item.classList.toggle("hit", round.multiplier >= 1);
    history.prepend(item);
    while (history.children.length > 5) history.lastChild.remove();
  };

  const setBusy = (busy) => {
    spinning = busy;
    spinButton.disabled = busy;
    betButtons.forEach((button) => { button.disabled = busy; });
  };

  // Spin until the server answers, then ease onto a segment showing the outcome.
  const spinTo = (outcome) => new Promise((resolve) => {
    const choices = SEGMENTS.map((id, index) => (id === outcome ? index : -1)).filter((index) => index >= 0);
    const index = choices[Math.floor(Math.random() * choices.length)];
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const current = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Segment `index` sits under the pointer when angle ≡ -index·step.
    let delta = ((-index * step + jitter - current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    delta += Math.PI * 2 * 4;
    const start = angle;
    const startTime = performance.now();
    const duration = 4200;
    let lastSegment = Math.floor(angle / step);
    const frame = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) ** 4;
      angle = start + delta * eased;
      const segment = Math.floor(angle / step);
      if (segment !== lastSegment) {
        lastSegment = segment;
        tone(1100, 0.03, 0.02);
      }
      draw();
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  spinButton.addEventListener("click", async () => {
    if (spinning) return;
    setBusy(true);
    message.classList.remove("win");
    message.textContent = "Spinning…";
    try {
      const round = await Gamish.play({ bet });
      await spinTo(round.outcome);
      addHistory(round);
      if (round.payout > 0) {
        message.textContent = `${multiplierOf[round.outcome]}× · +${round.payout.toLocaleString("en-US")}`;
        message.classList.toggle("win", round.multiplier > 1);
        if (round.multiplier >= 5) burst(140);
        else if (round.multiplier > 1) burst(50);
        tone(523, 0.25, 0.05); setTimeout(() => tone(784, 0.35, 0.05), 120);
      } else {
        message.textContent = "No win, spin again";
      }
      Gamish.track("spin_shown", { outcome: round.outcome, bet });
    } catch (error) {
      message.textContent = error.code === "insufficient_credits" ? "Not enough credits for this bet" : error.message;
    } finally {
      setBusy(false);
    }
  });
})();
