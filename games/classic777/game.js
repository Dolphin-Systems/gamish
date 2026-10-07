// Classic 777 — a five-reel, one-line slot.
// The server decides every round (Gamish.play); this file only presents the outcome it returns.
(() => {
  "use strict";

  // ---------- symbols ----------
  const SYMBOLS = ["seven", "bar2", "bar3", "bell", "cherry", "orange", "lemon", "plum", "melon", "star", "wild", "scatter", "jackpot", "coins"];
  const NAMES = {
    seven: "RED 7", bar2: "DOUBLE BAR", bar3: "TRIPLE BAR", bell: "BELL", cherry: "CHERRY", orange: "ORANGE",
    lemon: "LEMON", plum: "PLUM", melon: "WATERMELON", star: "STAR", wild: "WILD",
  };
  // Outcomes the WILD may stand in for when presenting a win.
  const WILD_CAN_SUB = new Set(["lemon", "plum", "orange", "cherry", "melon", "bell", "bar2", "bar3"]);
  const MISS_POOL = SYMBOLS.filter((s) => s !== "wild");
  const src = (s) => `img/${s}.webp`;
  SYMBOLS.forEach((s) => { const img = new Image(); img.src = src(s); });

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

  // A cosmetic row that is clearly not a line win.
  function looseRow(pool, count = 5) {
    for (;;) {
      const row = Array.from({ length: count }, () => pick(pool));
      if (row.every((symbol) => symbol === row[0])) continue;
      if (row.filter((s) => s === "scatter").length > 1) continue;
      return row;
    }
  }

  // Turn the server's outcome into the 5 × 3 grid shown on the reels (columns of [top, mid, bottom]).
  function gridFor(outcome) {
    let line;
    if (NAMES[outcome]) {
      line = Array(5).fill(outcome);
      if (WILD_CAN_SUB.has(outcome) && Math.random() < 0.32) line[Math.floor(Math.random() * 5)] = "wild";
    } else {
      line = looseRow(MISS_POOL);
    }
    const top = looseRow(SYMBOLS);
    const bottom = looseRow(SYMBOLS);
    return Array.from({ length: 5 }, (_, i) => [top[i], line[i], bottom[i]]);
  }

  // ---------- audio (starts only after a tap) ----------
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let muted = false;
    let tickTimer = null;

    function unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.55;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
    }

    function tone(freq, dur, { type = "sine", gain = 0.2, when = 0, slide = 0, attack = 0.005 } = {}) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(amp).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    function noise(dur, { gain = 0.15, when = 0, freq = 800 } = {}) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + when;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      const amp = ctx.createGain();
      amp.gain.value = gain;
      node.connect(filter).connect(amp).connect(master);
      node.start(t);
    }

    return {
      unlock,
      get muted() { return muted; },
      toggle() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.55;
        return muted;
      },
      click() { tone(1400, 0.05, { type: "triangle", gain: 0.08 }); },
      lever() {
        noise(0.18, { gain: 0.25, freq: 500 });
        tone(220, 0.25, { type: "triangle", gain: 0.12, slide: 0.5 });
      },
      startTicks() {
        this.stopTicks();
        tickTimer = setInterval(() => tone(900 + Math.random() * 200, 0.03, { type: "square", gain: 0.025 }), 75);
      },
      stopTicks() { clearInterval(tickTimer); tickTimer = null; },
      reelStop(i) {
        tone(150 - i * 12, 0.18, { type: "sine", gain: 0.35, slide: 0.45 });
        noise(0.07, { gain: 0.2, freq: 1800 });
      },
      tease() { tone(440, 0.6, { type: "sawtooth", gain: 0.05, slide: 2 }); },
      lose() { tone(330, 0.18, { type: "triangle", gain: 0.08, slide: 0.8 }); },
      win(level) {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
        const count = level >= 3 ? 6 : level === 2 ? 5 : 4;
        for (let i = 0; i < count; i++) {
          tone(notes[i], 0.22, { type: "triangle", gain: 0.16, when: i * 0.09 });
          tone(notes[i] * 2, 0.12, { type: "sine", gain: 0.05, when: i * 0.09 });
        }
        if (level >= 2) {
          for (let i = 0; i < 14 + level * 6; i++) tone(2000 + Math.random() * 1800, 0.08, { gain: 0.04, when: 0.4 + i * 0.07 });
        }
        if (level >= 3) {
          [523.25, 659.25, 783.99].forEach((f) => tone(f, 1.4, { type: "sawtooth", gain: 0.05, when: 0.55, attack: 0.05 }));
        }
      },
      error() { tone(180, 0.25, { type: "square", gain: 0.06 }); },
    };
  })();

  // ---------- coin fountain ----------
  const Fx = (() => {
    const canvas = document.getElementById("fx");
    const g = canvas.getContext("2d");
    let parts = [];
    let running = false;
    let last = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => p.y < innerHeight + 40 && p.life > 0);
      for (const p of parts) {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.spin += p.vs * dt;
        p.life -= dt;
        const w = Math.abs(Math.cos(p.spin)) * p.r + 1;
        g.save();
        g.globalAlpha = Math.min(1, p.life * 2);
        g.translate(p.x, p.y);
        if (p.spark) {
          g.fillStyle = "rgba(255,240,180,0.9)";
          g.beginPath();
          g.arc(0, 0, p.r * 0.35, 0, Math.PI * 2);
          g.fill();
        } else {
          const grad = g.createLinearGradient(-w, -p.r, w, p.r);
          grad.addColorStop(0, "#fff0b3");
          grad.addColorStop(0.45, "#ffc14f");
          grad.addColorStop(1, "#b8761d");
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(0, 0, w, p.r, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(120,70,10,0.8)";
          g.lineWidth = 1;
          g.stroke();
        }
        g.restore();
      }
      if (parts.length) requestAnimationFrame(frame);
      else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }

    addEventListener("resize", resize);
    resize();

    return {
      burst(x, y, count) {
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
          const speed = 320 + Math.random() * 520;
          parts.push({
            x: x + (Math.random() - 0.5) * 80, y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            r: 6 + Math.random() * 7, spin: Math.random() * 6, vs: 6 + Math.random() * 12,
            life: 2.2 + Math.random(), spark: Math.random() < 0.25,
          });
        }
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      },
    };
  })();

  // ---------- reels ----------
  const LOOP = 12;
  let cellPx = 72;

  function makeCell(symbol) {
    const cell = document.createElement("div");
    cell.className = "cell";
    const img = document.createElement("img");
    img.src = src(symbol);
    img.alt = "";
    img.draggable = false;
    cell.append(img);
    return cell;
  }

  class Reel {
    constructor(el, index) {
      this.el = el;
      this.index = index;
      this.strip = el.querySelector(".strip");
      this.symbols = ["lemon", "cherry", "bell"];
      this.base = [...this.symbols, "seven", "orange", "bar2", "plum", "bell", "star", "melon", "cherry", "wild"];
      this.position = 0;
      this.raf = 0;
      this.render(this.symbols);
    }

    render(list) {
      this.strip.replaceChildren(...list.map(makeCell));
    }

    setPos(p) { this.strip.style.transform = `translate3d(0, ${(-p * cellPx).toFixed(2)}px, 0)`; }

    // Spin a repeated physical strip while the server draws the round. The repeat lets
    // the reel wrap with no visible jump, then the landing strip decelerates into the result.
    start(delay) {
      this.stopped = null;
      this.base = Array.from({ length: LOOP }, () => pick(SYMBOLS));
      this.render([...this.base, ...this.base, ...this.base]);
      this.el?.classList.add("spinning");
      this.position = 0;
      let v = 0;
      let last = performance.now();
      const t0 = last + delay;
      this.setPos(0);
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (now >= t0) {
          v = Math.min(20, v + 70 * dt);
          if (v > 8) this.strip.classList.add("blur");
          this.position += v * dt;
          while (this.position >= LOOP) this.position -= LOOP;
          this.setPos(this.position);
        } else {
          // small wind-up before the drop
          this.setPos(Math.sin(((now - (t0 - delay)) / Math.max(1, delay)) * Math.PI) * -0.08);
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    // Land on the given column [top, middle, bottom] after several visible, slowing turns.
    land(column, duration) {
      cancelAnimationFrame(this.raf);
      const baseOffset = Math.floor(this.position) % LOOP;
      const visible = [...this.base.slice(baseOffset), ...this.base.slice(0, baseOffset)];
      const filler = Array.from({ length: 10 + this.index * 3 }, () => pick(SYMBOLS));
      const list = [...visible, ...filler, ...column, ...column];
      const target = visible.length + filler.length;
      this.render(list);
      this.setPos(0);
      this.strip.classList.add("blur");
      this.el?.classList.remove("spinning");
      return new Promise((resolve) => {
        const begin = performance.now();
        const ease = (t) => {
          const slow = 1 - (1 - Math.min(t, .88) / .88) ** 3;
          if (t <= .88) return slow * .965;
          const tail = (t - .88) / .12;
          return .965 + (.035 * (1 + Math.sin(tail * Math.PI) * .18));
        };
        const tick = (now) => {
          const t = Math.min(1, (now - begin) / duration);
          this.setPos(target * ease(t));
          if (t > 0.72) this.strip.classList.remove("blur");
          if (t < 1) this.raf = requestAnimationFrame(tick);
          else {
            this.symbols = [...column];
            this.render(this.symbols);
            this.setPos(0);
            resolve();
          }
        };
        this.raf = requestAnimationFrame(tick);
      });
    }

    middleCell() { return this.strip.children[1]; }
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const ui = {
    app: $("app"), machine: $("machine"), message: $("message"), balance: $("balance"), win: $("win"),
    betDown: $("betDown"), betUp: $("betUp"), betValue: $("betValue"), spin: $("spin"), auto: $("auto"),
    pays: $("pays"), sound: $("sound"), banner: $("banner"), bannerTitle: $("bannerTitle"),
    bannerAmount: $("bannerAmount"), sheet: $("sheet"), paytable: $("paytable"), closeSheet: $("closeSheet"),
  };
  const reels = [...document.querySelectorAll(".reel")].map((el, i) => new Reel(el, i));

  function layout() {
    const cabinet = document.querySelector(".cabinet");
    const style = getComputedStyle(cabinet);
    const width = cabinet.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const logo = document.querySelector(".logo").getBoundingClientRect().height - 18;
    const height = cabinet.clientHeight - logo - 40 - 58;
    const byHeight = height / 3;
    const byWidth = (width - 54) / 5.38;
    cellPx = Math.max(40, Math.min(112, Math.floor(Math.min(byHeight, byWidth))));
    document.documentElement.style.setProperty("--cell", `${cellPx}px`);
    reels.forEach((r) => r.setPos(0));
  }
  addEventListener("resize", layout);
  document.querySelector(".logo").addEventListener("load", layout);
  layout();

  function say(text, isError = false) {
    ui.message.textContent = text;
    ui.message.classList.toggle("error", isError);
  }

  // ---------- game ----------
  let session = null;
  let bets = [];
  let betIndex = 0;
  let balance = 0;
  let busy = false;
  let autoLeft = 0;
  const AUTO_ROUNDS = 10;

  const bet = () => bets[betIndex];

  function showWallet(wallet) {
    if (!wallet) return;
    balance = Number(wallet.totalCredits) || 0;
    ui.balance.textContent = fmt(balance);
  }

  function syncControls() {
    const locked = busy || autoLeft > 0;
    ui.spin.disabled = locked || !session;
    ui.betDown.disabled = locked || betIndex === 0;
    ui.betUp.disabled = locked || betIndex === bets.length - 1;
    ui.pays.disabled = busy;
    ui.auto.disabled = !session || (busy && autoLeft === 0);
    ui.auto.classList.toggle("on", autoLeft > 0);
    ui.auto.textContent = autoLeft > 0 ? `STOP ${autoLeft}` : "AUTO";
    ui.betValue.textContent = bets.length ? fmt(bet()) : "—";
  }

  function countUp(to, ms) {
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        ui.win.textContent = fmt(Math.round(to * t * 100) / 100);
        if (t < 1) requestAnimationFrame(step);
        else { ui.win.textContent = fmt(to); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  async function celebrate(round) {
    const mult = Number(round.multiplier) || 0;
    const level = mult >= 20 ? 3 : mult >= 10 ? 2 : 1;
    ui.machine.classList.add("winning");
    reels.forEach((r) => r.middleCell()?.classList.add("hit"));
    ui.app.querySelector(".meter.win").classList.add("lit");
    Sound.win(level);
    const box = ui.machine.getBoundingClientRect();
    Fx.burst(box.left + box.width / 2, box.top + box.height / 2, level === 3 ? 90 : level === 2 ? 50 : Math.min(26, 8 + mult * 4));

    const name = NAMES[round.outcome];
    const amount = fmt(round.payout);
    if (mult === 1) say(`5 × ${name} — stake back (${amount})`);
    else say(name ? `5 × ${name} — WIN ${amount} (${fmt(mult)}×)` : `WIN ${amount} (${fmt(mult)}×)`);

    if (level >= 2) {
      ui.bannerTitle.textContent = round.outcome === "seven" ? "JACKPOT!" : level === 3 ? "MEGA WIN" : "BIG WIN";
      ui.bannerAmount.textContent = "0";
      ui.banner.classList.add("show");
      const start = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - start) / 1400);
          ui.bannerAmount.textContent = fmt(Math.round(round.payout * t));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      ui.bannerAmount.textContent = amount;
      await Promise.all([countUp(round.payout, 300), sleep(900)]);
      ui.banner.classList.remove("show");
    } else {
      await countUp(round.payout, 500);
    }
  }

  function clearWinState() {
    ui.machine.classList.remove("winning");
    ui.app.querySelector(".meter.win").classList.remove("lit");
    document.querySelectorAll(".cell.hit").forEach((c) => c.classList.remove("hit"));
  }

  async function spin() {
    if (busy || !session) return;
    if (bet() > balance) {
      say("Not enough credits — lower your bet", true);
      Sound.error();
      autoLeft = 0;
      syncControls();
      return;
    }
    busy = true;
    clearWinState();
    ui.win.textContent = "0";
    say("Good luck!");
    syncControls();
    Sound.lever();
    Sound.startTicks();
    const previous = reels.map((r) => [...r.symbols]);
    reels.forEach((r, i) => r.start(80 + i * 70));
    const began = performance.now();

    let round = null;
    let failure = null;
    try {
      round = await Gamish.play({ bet: bet() }); // the server decides; we only show it
    } catch (error) {
      failure = error;
    }
    await sleep(Math.max(0, 750 - (performance.now() - began)));

    if (failure) {
      // No round was played: put the reels back where they were.
      await Promise.all(reels.map((r, i) => r.land(previous[i], 380 + i * 60)));
      Sound.stopTicks();
      Sound.error();
      const code = failure && failure.code;
      say(code === "insufficient_credits" ? "Not enough credits — lower your bet"
        : code === "busy" ? "A round is already running — try again in a moment"
        : "The round could not be played — please try again", true);
      autoLeft = 0;
      busy = false;
      syncControls();
      return;
    }

    const grid = gridFor(round.outcome);
    for (let i = 0; i < reels.length; i++) {
      const teasing = i === reels.length - 1
        && grid.slice(0, -1).every((column) => column[1] === grid[0][1])
        && ["seven", "star", "wild"].includes(grid[0][1]);
      if (teasing) { Sound.tease(); await sleep(650); }
      await reels[i].land(grid[i], teasing ? 1150 : 620 + i * 45);
      Sound.reelStop(i);
      if (i < reels.length - 1) await sleep(105);
    }
    Sound.stopTicks();
    showWallet(round.wallet);

    if (round.payout > 0) await celebrate(round);
    else { say("No win — spin again"); Sound.lose(); }

    Gamish.track("round_shown", { outcome: round.outcome, auto: autoLeft > 0 });
    busy = false;
    if (autoLeft > 0) {
      autoLeft -= 1;
      syncControls();
      if (autoLeft > 0) setTimeout(() => { if (autoLeft > 0 && !busy) spin(); }, round.payout > 0 ? 900 : 450);
    }
    syncControls();
  }

  // ---------- paytable ----------
  function buildPaytable(outcomes) {
    const rows = outcomes.filter((o) => o.multiplier > 0 && NAMES[o.id]).sort((a, b) => b.multiplier - a.multiplier);
    ui.paytable.replaceChildren(...rows.map((o) => {
      const li = document.createElement("li");
      const icons = document.createElement("span");
      icons.className = "icons";
      for (let i = 0; i < 5; i++) {
        const img = document.createElement("img");
        img.src = src(o.id);
        img.alt = i === 0 ? NAMES[o.id] : "";
        icons.append(img);
      }
      const pay = document.createElement("b");
      pay.textContent = `${fmt(o.multiplier)}×`;
      li.append(icons, pay);
      return li;
    }));
  }

  // ---------- controls ----------
  document.addEventListener("pointerdown", () => Sound.unlock(), { passive: true });

  ui.spin.addEventListener("click", () => { Sound.unlock(); spin(); });
  ui.betDown.addEventListener("click", () => { if (betIndex > 0) { betIndex--; Sound.click(); syncControls(); } });
  ui.betUp.addEventListener("click", () => { if (betIndex < bets.length - 1) { betIndex++; Sound.click(); syncControls(); } });
  ui.auto.addEventListener("click", () => {
    Sound.unlock();
    Sound.click();
    if (autoLeft > 0) { autoLeft = 0; say(busy ? "Auto stops after this spin" : "Auto stopped"); syncControls(); return; }
    autoLeft = AUTO_ROUNDS;
    Gamish.track("auto_start", { rounds: AUTO_ROUNDS, bet: bet() });
    syncControls();
    spin();
  });
  ui.pays.addEventListener("click", () => { Sound.click(); ui.sheet.hidden = false; });
  ui.closeSheet.addEventListener("click", () => { Sound.click(); ui.sheet.hidden = true; });
  ui.sheet.addEventListener("click", (e) => { if (e.target === ui.sheet) ui.sheet.hidden = true; });
  ui.sound.addEventListener("click", () => {
    Sound.unlock();
    const muted = Sound.toggle();
    ui.sound.classList.toggle("off", muted);
    ui.sound.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && ui.sheet.hidden) { e.preventDefault(); Sound.unlock(); if (!ui.spin.disabled) spin(); }
  });

  // ---------- start ----------
  const opening = gridFor("miss");
  reels.forEach((r, i) => { r.symbols = opening[i]; r.render(opening[i]); r.setPos(0); });
  syncControls();

  (async () => {
    try {
      session = await Gamish.connect();
    } catch (error) {
      say("Could not connect — please reopen the game", true);
      return;
    }
    bets = session.math.bets.slice();
    betIndex = 0;
    showWallet(session.wallet);
    Gamish.onWallet(showWallet);
    buildPaytable(session.math.outcomes || []);
    say(session.preview ? "Preview mode — practice credits" : "Set your bet and press SPIN");
    syncControls();
    layout();
  })();
})();
