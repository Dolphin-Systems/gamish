(() => {
  const symbolFrames = { cherry: 0, lemon: 1, orange: 2, grape: 3, bell: 4, seven: 5 };
  const scenes = {
    miss: ["lemon", "grape", "orange"], cherry: ["cherry", "cherry", "cherry"],
    lemon: ["lemon", "lemon", "lemon"], orange: ["orange", "orange", "orange"],
    grape: ["grape", "grape", "grape"], bell: ["bell", "bell", "bell"],
    seven: ["seven", "seven", "seven"]
  };
  const idleScene = ["orange", "grape", "lemon"];
  const money = value => `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  let audioContext;
  let soundOn = Gamish.sound !== false;
  const tone = (frequency, duration = 0.08) => {
    if (!soundOn) return;
    try {
      audioContext ??= new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {}
  };

  class FruitReels extends Phaser.Scene {
    constructor() {
      super("fruit-reels");
      this.reels = [];
    }

    preload() {
      this.load.spritesheet("fruit-symbols", "symbols.png", { frameWidth: 512, frameHeight: 512 });
    }

    create() {
      this.scale.on("resize", size => this.layout(size.width, size.height));
      for (let index = 0; index < 3; index += 1) {
        const maskShape = this.add.graphics();
        const symbol = this.add.image(0, 0, "fruit-symbols", symbolFrames[idleScene[index]]).setOrigin(0.5);
        symbol.setMask(maskShape.createGeometryMask());
        const shine = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0.06).setBlendMode(Phaser.BlendModes.ADD);
        this.reels.push({ index, maskShape, symbol, shine, rolling: false, spinTween: null });
      }
      this.layout(this.scale.width, this.scale.height);
      this.show(idleScene);
      window.fruitReelsReady?.(this);
    }

    layout(width, height) {
      const gap = Math.max(4, width * 0.018);
      const reelWidth = (width - gap * 2) / 3;
      this.reels.forEach((reel, index) => {
        const x = reelWidth * index + gap * index + reelWidth / 2;
        const y = height / 2;
        reel.maskShape.clear().fillStyle(0xffffff).fillRoundedRect(x - reelWidth / 2, 0, reelWidth, height, 7);
        reel.symbol.setPosition(x, y).setDisplaySize(reelWidth * 0.82, height * 0.82);
        reel.shine.setPosition(x, y - height * 0.28).setSize(reelWidth * 0.82, height * 0.18);
      });
    }

    show(symbols) {
      this.reels.forEach((reel, index) => {
        reel.symbol.setFrame(symbolFrames[symbols[index]]);
        reel.symbol.y = this.scale.height / 2;
        reel.symbol.clearTint();
      });
    }

    start() {
      this.reels.forEach(reel => {
        reel.rolling = true;
        this.roll(reel);
      });
    }

    roll(reel) {
      if (!reel.rolling) return;
      const downward = reel.index % 2 === 0;
      reel.symbol.y = downward ? -this.scale.height * 0.2 : this.scale.height * 1.2;
      reel.symbol.setFrame(Phaser.Math.Between(0, 5));
      reel.spinTween?.stop();
      reel.spinTween = this.tweens.add({
        targets: reel.symbol,
        y: downward ? this.scale.height * 1.2 : -this.scale.height * 0.2,
        duration: 145,
        ease: "Linear",
        onComplete: () => this.roll(reel)
      });
    }

    async stop(symbols) {
      for (const reel of this.reels) {
        reel.rolling = false;
        reel.spinTween?.stop();
        reel.symbol.setFrame(symbolFrames[symbols[reel.index]]);
        reel.symbol.y = -this.scale.height * 0.2;
        this.tweens.add({
          targets: reel.symbol,
          y: this.scale.height / 2,
          duration: 180,
          ease: "Back.Out"
        });
        tone(340 + reel.index * 130, 0.08);
        await wait(150);
      }
    }
  }

  let phaserReels;
  window.fruitReelsReady = scene => { phaserReels = scene; };
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "reels",
    backgroundColor: "transparent",
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    scene: FruitReels,
    render: { antialias: true, roundPixels: true }
  });

  const setStatus = (kicker, title, detail, state = "") => {
    const result = document.querySelector(".result");
    result.className = `result ${state}`.trim();
    document.getElementById("resultKicker").textContent = kicker;
    document.getElementById("resultTitle").textContent = title;
    document.getElementById("resultDetail").textContent = detail;
  };

  (async () => {
    const bets = document.getElementById("bets");
    const spin = document.getElementById("spin");
    const cabinet = document.querySelector(".cabinet");
    let busy = false;

    try {
      const session = await Gamish.connect();
      const reelScene = await new Promise(resolve => {
        if (phaserReels) resolve(phaserReels);
        else window.fruitReelsReady = resolve;
      });
      let bet = session.math.bets[0];
      Gamish.onSound?.(enabled => { soundOn = enabled; });
      document.getElementById("selectedBet").textContent = money(bet);

      session.math.bets.forEach(value => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = money(value);
        button.classList.toggle("on", value === bet);
        button.onclick = () => {
          if (busy) return;
          bet = value;
          document.getElementById("selectedBet").textContent = money(value);
          bets.querySelectorAll("button").forEach(item => item.classList.toggle("on", item === button));
          tone(500, 0.04);
        };
        bets.append(button);
      });

      spin.onclick = async () => {
        if (busy) return;
        busy = true;
        spin.disabled = true;
        bets.querySelectorAll("button").forEach(button => { button.disabled = true; });
        cabinet.classList.remove("won");
        setStatus("REELS IN MOTION", "Spinning…", "Securing your result.");
        reelScene.start();
        tone(180, 0.08);
        const startedAt = performance.now();
        try {
          const round = await Gamish.play({ bet });
          await wait(Math.max(0, 840 - (performance.now() - startedAt)));
          const symbols = scenes[round.outcome] || scenes.miss;
          await reelScene.stop(symbols);
          const win = round.payout > 0;
          setStatus(
            win ? `${round.multiplier}× PAYOUT` : "NO MATCH",
            win ? `${round.outcome.toUpperCase()} LINE!` : "Try another spin",
            win ? `You receive ${money(round.payout)}.` : "Only matching center symbols pay.",
            win ? "win" : "loss"
          );
          if (win) {
            cabinet.classList.add("won");
            tone(round.multiplier >= 5 ? 880 : 660, 0.2);
          } else tone(120, 0.13);
          Gamish.track("round_shown", { outcome: round.outcome, multiplier: round.multiplier });
        } catch (error) {
          await reelScene.stop(idleScene);
          setStatus(
            "UNABLE TO SPIN",
            error?.code === "insufficient_credits" ? "Insufficient balance" : "Please try again",
            error?.code === "insufficient_credits" ? "Choose a smaller wager." : "The spin could not be completed.",
            "loss"
          );
        } finally {
          busy = false;
          spin.disabled = false;
          bets.querySelectorAll("button").forEach(button => { button.disabled = false; });
        }
      };
    } catch (error) {
      const previewBlocked = /Preview needs this game's math\\.json/.test(error?.message || "");
      setStatus(
        previewBlocked ? "LOBBY REQUIRED" : "UNABLE TO LOAD",
        previewBlocked ? "Open Fruit Spin from Gamish777" : "Fruit Spin is unavailable",
        previewBlocked ? "The secure game is ready in the lobby." : "Please return to the lobby and try again.",
        "loss"
      );
      document.getElementById("spin").disabled = true;
    }
  })();
})();
