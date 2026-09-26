(() => {
  "use strict";

  const WIDTH = 768;
  const HEIGHT = 1536;
  const DISPLAY_FONT = '"Cinzel Decorative", Georgia, serif';
  const BODY_FONT = '"DM Sans", Arial, sans-serif';
  const COLORS = {
    ivory: 0xfff3d0,
    gold: 0xffc96b,
    goldDeep: 0xa85b18,
    ember: 0xff7a1a,
    ruby: 0xd83445,
    plum: 0x271027,
    panel: 0x130b17,
    cyan: 0x4de7e1,
    muted: 0xb9a7ad,
  };

  const GAME_CARDS = [
    { key: "phoenix", title: "PHOENIX RUBY", kicker: "PLAYABLE • VIRTUAL CREDITS", accent: 0xff7a1a },
    { key: "dragon", title: "DRAGON VAULT", kicker: "CRYSTAL FORTUNES", accent: 0x39d8e6 },
    { key: "lion", title: "SOLAR FORTUNE", kicker: "ROYAL REWARDS", accent: 0xffc14f },
    { key: "fox", title: "MOON FOX", kicker: "CELESTIAL WINS", accent: 0xb783ff },
  ];

  const PHOENIX_BETS = [10, 20, 40];
  const PHOENIX_SYMBOLS = [
    { mark: "7", color: "#ffcd69" },
    { mark: "◆", color: "#ff5365" },
    { mark: "♛", color: "#ffe2a3" },
    { mark: "✦", color: "#ff8b36" },
    { mark: "R", color: "#e9a3ff" },
  ];

  const secureRandom = () => {
    if (!window.crypto?.getRandomValues) return Math.random();
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] / 4294967296;
  };

  const makePhoenixOutcomeBag = () => {
    const bag = [...Array(18).fill(0), ...Array(8).fill(1.5), ...Array(4).fill(3)];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(secureRandom() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  };

  const statusNode = document.getElementById("scene-status");
  const setStatus = (message) => {
    if (statusNode) statusNode.textContent = message;
  };

  const fitBackground = (scene, key) => {
    const image = scene.add.image(WIDTH / 2, HEIGHT / 2, key);
    const source = scene.textures.get(key).getSourceImage();
    const coverScale = Math.max(WIDTH / source.width, HEIGHT / source.height);
    image.setScale(coverScale);
    return image;
  };

  const addAtmosphere = (scene, count = 34, palette = [0xff7a1a, 0xffca6d]) => {
    for (let i = 0; i < count; i += 1) {
      const radius = Phaser.Math.Between(2, 6);
      const ember = scene.add.circle(
        Phaser.Math.Between(20, WIDTH - 20),
        Phaser.Math.Between(100, HEIGHT + 120),
        radius,
        Phaser.Utils.Array.GetRandom(palette),
        Phaser.Math.FloatBetween(0.18, 0.62)
      );
      ember.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: ember,
        y: -60,
        x: ember.x + Phaser.Math.Between(-80, 80),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(0.2, 0.7),
        duration: Phaser.Math.Between(6000, 12000),
        delay: Phaser.Math.Between(0, 6000),
        repeat: -1,
        onRepeat: () => {
          ember.setPosition(Phaser.Math.Between(20, WIDTH - 20), HEIGHT + Phaser.Math.Between(20, 160));
          ember.setAlpha(Phaser.Math.FloatBetween(0.18, 0.62));
        },
      });
    }
  };

  const addVignette = (scene, alpha = 0.45) => {
    scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07040b, alpha).setBlendMode(Phaser.BlendModes.MULTIPLY);
    scene.add.rectangle(WIDTH / 2, 48, WIDTH, 220, 0x07040b, 0.58);
    scene.add.rectangle(WIDTH / 2, HEIGHT - 50, WIDTH, 240, 0x07040b, 0.52);
  };

  const traceCubic = (graphics, start, controlA, controlB, end, steps = 12) => {
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const inverse = 1 - t;
      const x = (inverse ** 3) * start.x + 3 * (inverse ** 2) * t * controlA.x + 3 * inverse * (t ** 2) * controlB.x + (t ** 3) * end.x;
      const y = (inverse ** 3) * start.y + 3 * (inverse ** 2) * t * controlA.y + 3 * inverse * (t ** 2) * controlB.y + (t ** 3) * end.y;
      graphics.lineTo(x, y);
    }
  };

  const traceQuadratic = (graphics, start, control, end, steps = 8) => {
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const inverse = 1 - t;
      const x = (inverse ** 2) * start.x + 2 * inverse * t * control.x + (t ** 2) * end.x;
      const y = (inverse ** 2) * start.y + 2 * inverse * t * control.y + (t ** 2) * end.y;
      graphics.lineTo(x, y);
    }
  };

  const addOrnatePanel = (scene, x, y, width, height, options = {}) => {
    const fill = options.fill ?? COLORS.panel;
    const fillAlpha = options.fillAlpha ?? 0.94;
    const stroke = options.stroke ?? COLORS.gold;
    const strokeAlpha = options.strokeAlpha ?? 0.58;
    const lineWidth = options.lineWidth ?? 2;
    const bend = Math.min(options.bend ?? 28, height * 0.25, width * 0.12);
    const left = x - width / 2;
    const right = x + width / 2;
    const top = y - height / 2;
    const bottom = y + height / 2;
    const panel = scene.add.graphics();

    const drawPath = () => {
      panel.beginPath();
      panel.moveTo(left + bend, top);
      traceCubic(panel,
        { x: left + bend, y: top }, { x: x - width * 0.2, y: top - 5 }, { x: x + width * 0.2, y: top + 5 }, { x: right - bend, y: top });
      traceQuadratic(panel, { x: right - bend, y: top }, { x: right + 9, y: top + 7 }, { x: right, y: top + bend });
      traceCubic(panel,
        { x: right, y: top + bend }, { x: right - 5, y: y - height * 0.16 }, { x: right + 5, y: y + height * 0.16 }, { x: right, y: bottom - bend });
      traceQuadratic(panel, { x: right, y: bottom - bend }, { x: right + 7, y: bottom - 7 }, { x: right - bend, y: bottom });
      traceCubic(panel,
        { x: right - bend, y: bottom }, { x: x + width * 0.2, y: bottom + 5 }, { x: x - width * 0.2, y: bottom - 5 }, { x: left + bend, y: bottom });
      traceQuadratic(panel, { x: left + bend, y: bottom }, { x: left - 9, y: bottom - 7 }, { x: left, y: bottom - bend });
      traceCubic(panel,
        { x: left, y: bottom - bend }, { x: left + 5, y: y + height * 0.16 }, { x: left - 5, y: y - height * 0.16 }, { x: left, y: top + bend });
      traceQuadratic(panel, { x: left, y: top + bend }, { x: left - 7, y: top + 7 }, { x: left + bend, y: top });
      panel.closePath();
    };

    panel.fillStyle(fill, fillAlpha);
    drawPath();
    panel.fillPath();
    panel.lineStyle(lineWidth, stroke, strokeAlpha);
    drawPath();
    panel.strokePath();

    if (options.anchors !== false) {
      const anchorSize = Math.max(4, Math.min(9, height * 0.055));
      panel.fillStyle(stroke, Math.min(1, strokeAlpha + 0.18));
      [[x, top], [x, bottom], [left, y], [right, y]].forEach(([anchorX, anchorY]) => {
        panel.fillPoints([
          new Phaser.Geom.Point(anchorX, anchorY - anchorSize),
          new Phaser.Geom.Point(anchorX + anchorSize, anchorY),
          new Phaser.Geom.Point(anchorX, anchorY + anchorSize),
          new Phaser.Geom.Point(anchorX - anchorSize, anchorY),
        ]);
      });
    }
    return panel;
  };

  const addRule = (scene, y, width = 430) => {
    const rule = scene.add.graphics();
    rule.lineStyle(2, COLORS.gold, 0.52);
    rule.beginPath();
    rule.moveTo(WIDTH / 2 - width / 2, y + 5);
    traceCubic(rule,
      { x: WIDTH / 2 - width / 2, y: y + 5 }, { x: WIDTH / 2 - width * 0.36, y: y - 13 },
      { x: WIDTH / 2 - width * 0.18, y: y + 13 }, { x: WIDTH / 2 - 24, y });
    rule.strokePath();
    rule.beginPath();
    rule.moveTo(WIDTH / 2 + 24, y);
    traceCubic(rule,
      { x: WIDTH / 2 + 24, y }, { x: WIDTH / 2 + width * 0.18, y: y + 13 },
      { x: WIDTH / 2 + width * 0.36, y: y - 13 }, { x: WIDTH / 2 + width / 2, y: y + 5 });
    rule.strokePath();
    rule.fillStyle(COLORS.ember, 0.95);
    rule.fillPoints([
      new Phaser.Geom.Point(WIDTH / 2, y - 8),
      new Phaser.Geom.Point(WIDTH / 2 + 8, y),
      new Phaser.Geom.Point(WIDTH / 2, y + 8),
      new Phaser.Geom.Point(WIDTH / 2 - 8, y),
    ]);
    return rule;
  };

  const makeButton = (scene, x, y, width, height, label, onClick, options = {}) => {
    const accent = options.accent ?? COLORS.ember;
    const container = scene.add.container(x, y);
    const halo = addOrnatePanel(scene, 0, 0, width + 14, height + 14, {
      fill: accent, fillAlpha: 0.12, stroke: accent, strokeAlpha: 0.2, bend: height * 0.35,
    });
    const plate = addOrnatePanel(scene, 0, 0, width, height, {
      fill: options.fill ?? 0x2b1014, fillAlpha: 0.96, stroke: options.stroke ?? COLORS.gold, strokeAlpha: 0.9, bend: height * 0.34,
    });
    const shine = scene.add.ellipse(0, -height * 0.28, width * 0.52, 4, 0xffffff, 0.16);
    const text = scene.add.text(0, 1, label, {
      fontFamily: BODY_FONT,
      fontSize: options.fontSize ?? "23px",
      fontStyle: "700",
      color: options.color ?? "#fff3d0",
      letterSpacing: 3,
      align: "center",
    }).setOrigin(0.5);

    container.add([halo, plate, shine, text]);
    container.setSize(width, height).setInteractive({ useHandCursor: true });
    container.on("pointerover", () => scene.tweens.add({ targets: container, scale: 1.035, duration: 120 }));
    container.on("pointerout", () => scene.tweens.add({ targets: container, scale: 1, duration: 140 }));
    container.on("pointerdown", () => {
      window.GamishAudio?.play("tap");
      scene.tweens.add({ targets: container, scale: 0.97, duration: 70, yoyo: true });
    });
    container.on("pointerup", onClick);
    scene.tweens.add({ targets: halo, alpha: { from: 0.28, to: 0.7 }, duration: 1200, yoyo: true, repeat: -1 });
    return container;
  };

  const addTopBar = (scene, options = {}) => {
    const bar = addOrnatePanel(scene, WIDTH / 2, 58, WIDTH - 42, 82, {
      fill: COLORS.panel, fillAlpha: 0.84, stroke: COLORS.gold, strokeAlpha: 0.34, bend: 28,
    });

    if (options.back) {
      const back = scene.add.container(62, 52);
      const disk = scene.add.circle(0, 0, 27, 0x0e0912, 0.94).setStrokeStyle(2, COLORS.gold, 0.65);
      const arrow = scene.add.text(-1, -2, "‹", { fontFamily: BODY_FONT, fontSize: "45px", color: "#ffe4a3" }).setOrigin(0.5);
      back.add([disk, arrow]).setSize(64, 64).setInteractive({ useHandCursor: true });
      back.on("pointerup", () => {
        window.GamishAudio?.play("nav");
        options.back();
      });
      back.on("pointerover", () => scene.tweens.add({ targets: back, scale: 1.08, duration: 120 }));
      back.on("pointerout", () => scene.tweens.add({ targets: back, scale: 1, duration: 120 }));
    }

    scene.add.text(105, 52, options.title ?? "GAMISH777", {
      fontFamily: DISPLAY_FONT,
      fontSize: "22px",
      color: "#fff0c0",
      stroke: "#5d250d",
      strokeThickness: 4,
    }).setOrigin(0, 0.5);
    return bar;
  };

  class BootScene extends Phaser.Scene {
    constructor() {
      super("Boot");
    }

    preload() {
      const track = addOrnatePanel(this, WIDTH / 2, HEIGHT / 2 + 40, 420, 18, {
        fill: 0x4b2a38, fillAlpha: 0.65, stroke: COLORS.gold, strokeAlpha: 0.2, lineWidth: 1, bend: 7, anchors: false,
      });
      const bar = this.add.graphics();
      this.add.text(WIDTH / 2, HEIGHT / 2 - 20, "OPENING THE EMBER CROWN", {
        fontFamily: DISPLAY_FONT,
        fontSize: "22px",
        color: "#f3d59a",
        letterSpacing: 3,
      }).setOrigin(0.5);
      this.load.on("progress", (value) => {
        bar.clear();
        bar.fillStyle(COLORS.ember, 1);
        bar.fillRoundedRect(WIDTH / 2 - 210, HEIGHT / 2 + 34, 420 * value, 12, 6);
      });
      this.load.on("complete", () => { track.setAlpha(0.2); });

      this.load.image("landing-bg", "assets/ember-citadel.webp");
      this.load.image("hall-bg", "assets/portal-hall.webp");
      this.load.image("phoenix", "assets/phoenix-ruby.webp");
      this.load.image("dragon", "assets/dragon-vault.webp");
      this.load.image("lion", "assets/lion-fortune.webp");
      this.load.image("fox", "assets/moon-fox.webp");
    }

    create() {
      document.getElementById("loading-fallback")?.classList.add("ready");
      this.scene.start("Landing");
    }
  }

  class LandingScene extends Phaser.Scene {
    constructor() {
      super("Landing");
      this.jackpot = 12849.02;
    }

    create() {
      setStatus("Gamish777 landing screen. Activate Enter the Arcade to open the Game Zone.");
      fitBackground(this, "landing-bg");
      addVignette(this, 0.27);
      addAtmosphere(this, 42);
      addTopBar(this);

      const crownGlow = this.add.circle(WIDTH / 2, 226, 128, COLORS.ember, 0.08);
      this.tweens.add({ targets: crownGlow, scale: 1.24, alpha: 0.2, duration: 1800, yoyo: true, repeat: -1 });

      this.add.text(WIDTH / 2, 154, "THE", {
        fontFamily: BODY_FONT,
        fontSize: "18px",
        fontStyle: "700",
        color: "#efc77e",
        letterSpacing: 10,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 206, "EMBER CROWN", {
        fontFamily: DISPLAY_FONT,
        fontSize: "45px",
        color: "#fff3c1",
        stroke: "#6d2408",
        strokeThickness: 8,
        shadow: { offsetY: 8, color: "#000000", blur: 12, fill: true },
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 259, "ARCADE", {
        fontFamily: DISPLAY_FONT,
        fontSize: "31px",
        color: "#ff9b32",
        stroke: "#48150b",
        strokeThickness: 6,
        letterSpacing: 12,
      }).setOrigin(0.5);
      addRule(this, 308, 500);

      const jackpotPanel = addOrnatePanel(this, WIDTH / 2, 480, 590, 168, {
        fill: 0x09070c, fillAlpha: 0.78, stroke: COLORS.gold, strokeAlpha: 0.74, bend: 34,
      });
      this.add.text(WIDTH / 2, 419, "GRAND JACKPOT", {
        fontFamily: BODY_FONT,
        fontSize: "18px",
        fontStyle: "700",
        color: "#dfb871",
        letterSpacing: 7,
      }).setOrigin(0.5);
      const jackpotText = this.add.text(WIDTH / 2, 477, "$12,849.02", {
        fontFamily: DISPLAY_FONT,
        fontSize: "46px",
        color: "#ff7b32",
        stroke: "#54120a",
        strokeThickness: 6,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 532, "MINI  $24.47     •     MAJOR  $1,274.20", {
        fontFamily: BODY_FONT,
        fontSize: "16px",
        fontStyle: "700",
        color: "#ffe4a7",
        letterSpacing: 2,
      }).setOrigin(0.5);
      this.tweens.add({ targets: jackpotPanel, alpha: { from: 0.72, to: 0.92 }, duration: 1300, yoyo: true, repeat: -1 });

      this.time.addEvent({
        delay: 1150,
        loop: true,
        callback: () => {
          this.jackpot += Phaser.Math.FloatBetween(0.11, 1.84);
          jackpotText.setText(`$${this.jackpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          this.tweens.add({ targets: jackpotText, scale: 1.035, duration: 100, yoyo: true });
        },
      });

      const seal = this.add.container(WIDTH / 2, 720);
      const outer = this.add.circle(0, 0, 102, 0x170b18, 0.9).setStrokeStyle(5, COLORS.gold, 0.9);
      const inner = this.add.circle(0, 0, 78, 0x6e1d12, 0.78).setStrokeStyle(2, COLORS.ember, 0.9);
      const gem = this.add.text(0, -5, "◆", { fontFamily: BODY_FONT, fontSize: "72px", color: "#ffbd58" }).setOrigin(0.5);
      const seven = this.add.text(0, 14, "777", {
        fontFamily: DISPLAY_FONT,
        fontSize: "27px",
        color: "#fff3ca",
        stroke: "#671e0a",
        strokeThickness: 5,
      }).setOrigin(0.5);
      seal.add([outer, inner, gem, seven]);
      this.tweens.add({ targets: gem, angle: 360, duration: 12000, repeat: -1 });
      this.tweens.add({ targets: seal, y: 708, duration: 1800, yoyo: true, ease: "Sine.inOut", repeat: -1 });

      this.add.text(WIDTH / 2, 870, "FORTUNE FAVORS THE BOLD", {
        fontFamily: BODY_FONT,
        fontSize: "17px",
        fontStyle: "700",
        color: "#e9c585",
        letterSpacing: 5,
      }).setOrigin(0.5);

      makeButton(this, WIDTH / 2, 965, 488, 82, "ENTER THE ARCADE", () => {
        setStatus("Opening the Game Zone.");
        this.cameras.main.flash(260, 255, 137, 46, false);
        this.cameras.main.fadeOut(430, 20, 8, 18);
        this.time.delayedCall(430, () => this.scene.start("GameZone"));
      }, { fill: 0x7d2013, stroke: 0xffd17b, fontSize: "24px" });

      this.add.text(WIDTH / 2, 1048, "ORIGINAL WORLDS  •  NEW FORTUNES", {
        fontFamily: BODY_FONT,
        fontSize: "13px",
        fontStyle: "700",
        color: "#b9a7ad",
        letterSpacing: 3,
      }).setOrigin(0.5);

      this.add.text(WIDTH / 2, 1450, "A PHASER-POWERED EXPERIENCE", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        color: "#a58b7e",
        letterSpacing: 4,
      }).setOrigin(0.5);

      this.cameras.main.fadeIn(650, 7, 4, 11);
    }
  }

  class GameZoneScene extends Phaser.Scene {
    constructor() {
      super("GameZone");
      this.modal = null;
    }

    create() {
      setStatus("Game Zone. Phoenix Ruby is playable with virtual credits; three worlds are available to preview.");
      fitBackground(this, "hall-bg");
      addVignette(this, 0.36);
      addAtmosphere(this, 28, [0xffad42, 0x6ee7ea, 0xd994ff]);
      addTopBar(this, {
        title: "GAME ZONE",
        back: () => this.returnToLanding(),
      });

      this.add.text(WIDTH / 2, 158, "CHOOSE YOUR FORTUNE", {
        fontFamily: DISPLAY_FONT,
        fontSize: "34px",
        color: "#fff1c6",
        stroke: "#55200d",
        strokeThickness: 7,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 204, "Four original worlds. One crown.", {
        fontFamily: BODY_FONT,
        fontSize: "17px",
        color: "#d1b7b5",
        letterSpacing: 2,
      }).setOrigin(0.5);
      addRule(this, 246, 510);

      const positions = [
        { x: 208, y: 520 },
        { x: 560, y: 520 },
        { x: 208, y: 970 },
        { x: 560, y: 970 },
      ];

      GAME_CARDS.forEach((game, index) => {
        this.addGameCard(game, positions[index], index);
      });

      this.add.text(WIDTH / 2, 1390, "MORE PORTALS AWAKENING SOON", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        fontStyle: "700",
        color: "#d3b473",
        letterSpacing: 4,
      }).setOrigin(0.5);

      this.input.keyboard?.on("keydown-ESC", () => {
        if (this.modal) this.closeModal(); else this.returnToLanding();
      });
      this.cameras.main.fadeIn(550, 9, 5, 12);
    }

    addGameCard(game, position, index) {
      const card = this.add.container(position.x, position.y);
      const glow = addOrnatePanel(this, 0, 0, 316, 350, {
        fill: game.accent, fillAlpha: 0.09, stroke: game.accent, strokeAlpha: 0.2, bend: 34,
      });
      const panel = addOrnatePanel(this, 0, 0, 300, 334, {
        fill: COLORS.panel, fillAlpha: 0.94, stroke: game.accent, strokeAlpha: 0.82, bend: 32,
      });
      const image = this.add.image(0, -42, game.key).setDisplaySize(266, 266);
      const shade = addOrnatePanel(this, 0, 80, 270, 82, {
        fill: 0x09060b, fillAlpha: 0.9, stroke: game.accent, strokeAlpha: 0.12, bend: 22, anchors: false,
      });
      const title = this.add.text(0, 76, game.title, {
        fontFamily: DISPLAY_FONT,
        fontSize: "18px",
        color: "#fff2ce",
        stroke: "#36100a",
        strokeThickness: 4,
        align: "center",
      }).setOrigin(0.5);
      const kickerColor = Phaser.Display.Color.IntegerToColor(game.accent).rgba;
      const kicker = this.add.text(0, 111, game.kicker, {
        fontFamily: BODY_FONT,
        fontSize: "11px",
        fontStyle: "700",
        color: kickerColor,
        letterSpacing: 2,
      }).setOrigin(0.5);
      const badge = addOrnatePanel(this, 0, 144, 154, 28, {
        fill: game.accent, fillAlpha: 0.18, stroke: game.accent, strokeAlpha: 0.72, lineWidth: 1, bend: 10,
      });
      const badgeText = this.add.text(0, 144, index === 0 ? "FEATURED" : "PREVIEW", {
        fontFamily: BODY_FONT,
        fontSize: "11px",
        fontStyle: "700",
        color: "#fff1d1",
        letterSpacing: 2,
      }).setOrigin(0.5);
      card.add([glow, panel, image, shade, title, kicker, badge, badgeText]);
      card.setSize(316, 350).setInteractive({ useHandCursor: true });
      card.on("pointerover", () => {
        this.tweens.add({ targets: card, scale: 1.035, duration: 140 });
        this.tweens.add({ targets: glow, alpha: 0.5, duration: 180 });
      });
      card.on("pointerout", () => {
        this.tweens.add({ targets: card, scale: 1, duration: 160 });
        this.tweens.add({ targets: glow, alpha: 0.2, duration: 180 });
      });
      card.on("pointerdown", () => {
        window.GamishAudio?.play("tap");
        this.tweens.add({ targets: card, scale: 0.97, duration: 70, yoyo: true });
      });
      card.on("pointerup", () => {
        if (index === 0) {
          this.cameras.main.fadeOut(320, 12, 4, 10);
          this.time.delayedCall(320, () => this.scene.start("PhoenixGame"));
          return;
        }
        this.openGameModal(game);
      });
      card.setAlpha(0).setY(position.y + 34);
      this.tweens.add({
        targets: card,
        alpha: 1,
        y: position.y,
        duration: 520,
        delay: 90 + index * 100,
        ease: "Back.Out",
      });
    }

    openGameModal(game) {
      if (this.modal) return;
      setStatus(`${game.title} preview. This game portal is coming soon.`);
      const modal = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(100);
      const blocker = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x060309, 0.84).setInteractive();
      const glow = this.add.circle(0, -122, 178, game.accent, 0.14);
      const panel = addOrnatePanel(this, 0, 0, 596, 704, {
        fill: 0x110a15, fillAlpha: 0.98, stroke: game.accent, strokeAlpha: 0.88, lineWidth: 3, bend: 44,
      });
      const art = this.add.image(0, -132, game.key).setDisplaySize(420, 420);
      const title = this.add.text(0, 120, game.title, {
        fontFamily: DISPLAY_FONT,
        fontSize: "30px",
        color: "#fff0c2",
        stroke: "#4c180c",
        strokeThickness: 6,
      }).setOrigin(0.5);
      const copy = this.add.text(0, 175, "THE PORTAL IS AWAKENING\nYour balance stays safe while we build.", {
        fontFamily: BODY_FONT,
        fontSize: "18px",
        color: "#cbb8bf",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5);
      modal.add([blocker, glow, panel, art, title, copy]);
      const close = makeButton(this, WIDTH / 2, HEIGHT / 2 + 272, 360, 66, "BACK TO THE HALL", () => this.closeModal(), {
        fill: 0x5a1916,
        stroke: game.accent,
        accent: game.accent,
        fontSize: "18px",
      }).setDepth(101);
      modal.setScale(0.9).setAlpha(0);
      this.tweens.add({ targets: modal, scale: 1, alpha: 1, duration: 240, ease: "Back.Out" });
      this.tweens.add({ targets: glow, scale: 1.18, alpha: 0.3, duration: 1300, yoyo: true, repeat: -1 });
      this.modal = { modal, close };
    }

    closeModal() {
      if (!this.modal) return;
      const { modal, close } = this.modal;
      this.modal = null;
      this.tweens.add({
        targets: [modal, close],
        alpha: 0,
        scale: 0.94,
        duration: 180,
        onComplete: () => {
          modal.destroy(true);
          close.destroy(true);
          setStatus("Game Zone. Phoenix Ruby is playable with virtual credits; three worlds are available to preview.");
        },
      });
    }

    returnToLanding() {
      if (this.modal) return;
      this.cameras.main.fadeOut(380, 10, 4, 14);
      this.time.delayedCall(380, () => this.scene.start("Landing"));
    }
  }

  class PhoenixGameScene extends Phaser.Scene {
    constructor() {
      super("PhoenixGame");
      this.credits = 1000;
      this.bet = 10;
      this.lastWin = 0;
      this.totalWagered = 0;
      this.totalReturned = 0;
      this.spinCount = 0;
      this.isSpinning = false;
      this.outcomeBags = new Map();
      this.reelTexts = [];
      this.betButtons = new Map();
    }

    create() {
      this.reelTexts = [];
      this.betButtons = new Map();
      this.isSpinning = false;
      setStatus("Phoenix Ruby. A curved, animated virtual-credit reel game with no cash value.");
      fitBackground(this, "phoenix");
      addVignette(this, 0.62);
      addAtmosphere(this, 24, [0xff6b22, 0xffc868, 0xd83445]);
      addTopBar(this, {
        title: "PHOENIX RUBY",
        back: () => this.returnToHall(),
      });

      this.add.text(WIDTH / 2, 130, "EMBER CIRCUIT", {
        fontFamily: DISPLAY_FONT,
        fontSize: "38px",
        color: "#fff0bb",
        stroke: "#64180b",
        strokeThickness: 7,
        letterSpacing: 3,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 178, "VIRTUAL CREDITS • NO CASH VALUE", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        fontStyle: "700",
        color: "#e5b67a",
        letterSpacing: 3,
      }).setOrigin(0.5);

      this.creditText = this.addStatCard(146, 252, "CREDITS", "1,000");
      this.betText = this.addStatCard(384, 252, "BET", "10");
      this.winText = this.addStatCard(622, 252, "LAST WIN", "0");

      const machineGlow = addOrnatePanel(this, WIDTH / 2, 595, 670, 578, {
        fill: COLORS.ember, fillAlpha: 0.08, stroke: COLORS.ember, strokeAlpha: 0.2, bend: 52,
      });
      this.machinePanel = addOrnatePanel(this, WIDTH / 2, 595, 646, 554, {
        fill: 0x100914, fillAlpha: 0.97, stroke: COLORS.gold, strokeAlpha: 0.84, lineWidth: 3, bend: 48,
      });
      addOrnatePanel(this, WIDTH / 2, 344, 610, 42, {
        fill: 0x43130f, fillAlpha: 0.94, stroke: COLORS.ember, strokeAlpha: 0.8, lineWidth: 1, bend: 14,
      });
      this.cycleText = this.add.text(WIDTH / 2, 344, "EMBER SPIN  •  BET 10", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        fontStyle: "700",
        color: "#ffd28a",
        letterSpacing: 3,
      }).setOrigin(0.5);

      const reelXs = [188, 384, 580];
      const reelYs = [438, 595, 752];
      reelYs.forEach((y, row) => {
        reelXs.forEach((x, column) => {
          const cell = addOrnatePanel(this, x, y, 174, 138, {
            fill: row === 1 ? 0x26101c : 0x1b101d,
            fillAlpha: 0.98,
            stroke: 0x9d5b3f,
            strokeAlpha: row === 1 ? 0.92 : 0.68,
            bend: 24,
          });
          const symbol = PHOENIX_SYMBOLS[(row * 2 + column) % PHOENIX_SYMBOLS.length];
          const text = this.add.text(x, y - 3, symbol.mark, {
            fontFamily: DISPLAY_FONT,
            fontSize: symbol.mark === "7" ? "74px" : "63px",
            color: symbol.color,
            stroke: "#3b0d0b",
            strokeThickness: 7,
            shadow: { offsetY: 6, color: "#000000", blur: 12, fill: true },
          }).setOrigin(0.5);
          this.reelTexts.push(text);
        });
      });

      this.winLine = this.add.graphics();
      this.winLine.lineStyle(4, COLORS.gold, 0.3);
      this.winLine.beginPath();
      this.winLine.moveTo(86, 600);
      traceCubic(this.winLine, { x: 86, y: 600 }, { x: 220, y: 566 }, { x: 548, y: 624 }, { x: 682, y: 590 }, 24);
      this.winLine.strokePath();
      this.resultText = this.add.text(WIDTH / 2, 860, "PRESS SPIN TO BEGIN", {
        fontFamily: BODY_FONT,
        fontSize: "17px",
        fontStyle: "700",
        color: "#d8bd9c",
        letterSpacing: 4,
      }).setOrigin(0.5);
      this.tweens.add({ targets: machineGlow, alpha: { from: 0.08, to: 0.25 }, duration: 1300, yoyo: true, repeat: -1 });

      this.spinButton = makeButton(this, WIDTH / 2, 950, 520, 92, "SPIN  •  10 CREDITS", () => this.spin(), {
        fill: 0x8a2415,
        stroke: 0xffd27e,
        accent: COLORS.ember,
        fontSize: "25px",
      });

      this.add.text(72, 1034, "SELECT BET", {
        fontFamily: BODY_FONT,
        fontSize: "13px",
        fontStyle: "700",
        color: "#c9a475",
        letterSpacing: 3,
      });
      PHOENIX_BETS.forEach((amount, index) => {
        const button = makeButton(this, 242 + index * 176, 1060, 150, 56, `${amount} CR`, () => this.selectBet(amount), {
          fill: amount === this.bet ? 0x642019 : 0x1d111e,
          stroke: amount === this.bet ? COLORS.gold : 0x754c4d,
          accent: amount === this.bet ? COLORS.ember : 0x5c3a45,
          fontSize: "16px",
        });
        this.betButtons.set(amount, button);
      });

      this.rulesPanel = addOrnatePanel(this, WIDTH / 2, 1238, 646, 252, {
        fill: 0x100914, fillAlpha: 0.96, stroke: COLORS.gold, strokeAlpha: 0.54, bend: 38,
      });
      this.add.text(86, 1142, "EMBER MOMENTUM", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        fontStyle: "700",
        color: "#f0c675",
        letterSpacing: 4,
      });
      this.add.text(86, 1184, "MATCH THE CENTER ARC", {
        fontFamily: DISPLAY_FONT,
        fontSize: "22px",
        color: "#fff0c0",
      });
      this.add.text(86, 1220, "Ruby line pays 1.5×  •  Golden 7 line pays 3×", {
        fontFamily: BODY_FONT,
        fontSize: "15px",
        color: "#cdb7bd",
      });
      this.add.text(86, 1270, "KEEP THE FLAME MOVING", {
        fontFamily: DISPLAY_FONT,
        fontSize: "22px",
        color: "#fff0c0",
      });
      this.add.text(86, 1306, "Every spin reshuffles the virtual-credit ember deck", {
        fontFamily: BODY_FONT,
        fontSize: "15px",
        color: "#cdb7bd",
      });
      this.sessionText = this.add.text(682, 1160, "SESSION\n0 SPINS\n0 CR WON", {
        fontFamily: BODY_FONT,
        fontSize: "15px",
        fontStyle: "700",
        color: "#ffba62",
        align: "right",
        lineSpacing: 8,
      }).setOrigin(1, 0);

      makeButton(this, WIDTH / 2, 1368, 310, 54, "RESET DEMO CREDITS", () => this.resetDemo(), {
        fill: 0x1b101b,
        stroke: 0x8a5b50,
        accent: 0x68424c,
        fontSize: "14px",
      });

      this.input.keyboard?.on("keydown-SPACE", () => this.spin());
      this.input.keyboard?.on("keydown-ESC", () => this.returnToHall());
      this.cameras.main.fadeIn(500, 8, 4, 10);
    }

    addStatCard(x, y, label, value) {
      addOrnatePanel(this, x, y, 210, 96, {
        fill: 0x100914, fillAlpha: 0.94, stroke: 0x9d5f43, strokeAlpha: 0.75, bend: 22,
      });
      this.add.text(x, y - 23, label, {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#b79b91",
        letterSpacing: 3,
      }).setOrigin(0.5);
      return this.add.text(x, y + 17, value, {
        fontFamily: DISPLAY_FONT,
        fontSize: "25px",
        color: "#ffe8ae",
      }).setOrigin(0.5);
    }

    getOutcome() {
      let bag = this.outcomeBags.get(this.bet);
      if (!bag?.length) {
        bag = makePhoenixOutcomeBag();
        this.outcomeBags.set(this.bet, bag);
      }
      const multiplier = bag.pop();
      return { multiplier, position: 30 - bag.length };
    }

    randomSymbol(excludedMark) {
      const choices = excludedMark ? PHOENIX_SYMBOLS.filter((symbol) => symbol.mark !== excludedMark) : PHOENIX_SYMBOLS;
      return choices[Math.floor(secureRandom() * choices.length)];
    }

    setSymbol(text, symbol) {
      text.setText(symbol.mark).setColor(symbol.color).setFontSize(symbol.mark === "7" ? 74 : 63);
    }

    buildResultGrid(multiplier) {
      const symbols = Array.from({ length: 9 }, () => this.randomSymbol());
      if (multiplier === 3) {
        symbols[3] = PHOENIX_SYMBOLS[0];
        symbols[4] = PHOENIX_SYMBOLS[0];
        symbols[5] = PHOENIX_SYMBOLS[0];
      } else if (multiplier === 1.5) {
        symbols[3] = PHOENIX_SYMBOLS[1];
        symbols[4] = PHOENIX_SYMBOLS[1];
        symbols[5] = PHOENIX_SYMBOLS[1];
      } else if (symbols[3].mark === symbols[4].mark && symbols[4].mark === symbols[5].mark) {
        symbols[5] = this.randomSymbol(symbols[4].mark);
      }
      return symbols;
    }

    spin() {
      if (this.isSpinning) return;
      if (this.credits < this.bet) {
        this.resultText.setText("NOT ENOUGH CREDITS — RESET THE DEMO").setColor("#ff7f72");
        setStatus("Not enough virtual credits. Activate Reset Demo Credits to continue.");
        this.cameras.main.shake(160, 0.005);
        return;
      }

      this.isSpinning = true;
      window.GamishAudio?.play("spin");
      this.credits -= this.bet;
      this.totalWagered += this.bet;
      this.spinCount += 1;
      this.lastWin = 0;
      const outcome = this.getOutcome();
      this.cycleText.setText(`EMBER SPIN ${this.spinCount}  •  BET ${this.bet}`);
      this.resultText.setText("THE EMBERS ARE TURNING…").setColor("#ffd58c");
      this.spinButton.disableInteractive().setAlpha(0.72);
      this.refreshHud();

      let ticks = 0;
      const spinner = this.time.addEvent({
        delay: 72,
        repeat: 11,
        callback: () => {
          ticks += 1;
          this.reelTexts.forEach((text, index) => {
            if (ticks < 7 + (index % 3) * 2) this.setSymbol(text, this.randomSymbol());
          });
          if (ticks % 3 === 0) {
            window.GamishAudio?.play("tick");
            this.cameras.main.shake(45, 0.0014);
          }
        },
      });

      this.time.delayedCall(980, () => {
        spinner.remove(false);
        const grid = this.buildResultGrid(outcome.multiplier);
        this.reelTexts.forEach((text, index) => this.setSymbol(text, grid[index]));
        const payout = this.bet * outcome.multiplier;
        this.lastWin = payout;
        this.credits += payout;
        this.totalReturned += payout;

        if (payout > 0) {
          window.GamishAudio?.play(outcome.multiplier === 3 ? "win-big" : "win-small");
          this.resultText.setText(`WIN  +${payout.toLocaleString("en-US")} CREDITS  •  ${outcome.multiplier}×`).setColor("#ffdc83");
          this.tweens.add({ targets: this.reelTexts.slice(3, 6), scale: 1.16, duration: 180, yoyo: true, repeat: 2 });
          this.tweens.add({ targets: this.winLine, alpha: 1, scaleX: 1.05, duration: 190, yoyo: true, repeat: 3 });
          this.cameras.main.flash(220, 255, 126, 34, false);
          setStatus(`Phoenix Ruby win. ${payout} virtual credits returned at ${outcome.multiplier} times the bet.`);
        } else {
          window.GamishAudio?.play("lose");
          this.resultText.setText("NO WIN  •  THE PHOENIX RISES AGAIN").setColor("#c4abb1");
          setStatus("Phoenix Ruby spin complete. No win on this virtual-credit spin.");
        }

        this.refreshHud();
        this.isSpinning = false;
        this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
      });
    }

    selectBet(amount) {
      if (this.isSpinning || this.bet === amount) return;
      this.bet = amount;
      this.betButtons.forEach((button, value) => {
        button.setAlpha(value === amount ? 1 : 0.7);
        this.tweens.add({ targets: button, scale: value === amount ? 1.045 : 1, duration: 140 });
      });
      this.cycleText.setText(`EMBER SPIN ${this.spinCount}  •  BET ${amount}`);
      this.refreshHud();
      setStatus(`Phoenix Ruby bet set to ${amount} virtual credits.`);
    }

    refreshHud() {
      this.creditText.setText(this.credits.toLocaleString("en-US"));
      this.betText.setText(this.bet.toLocaleString("en-US"));
      this.winText.setText(this.lastWin.toLocaleString("en-US"));
      this.spinButton.getAt(3).setText(`SPIN  •  ${this.bet} CREDITS`);
      this.sessionText.setText(`SESSION\n${this.spinCount} SPIN${this.spinCount === 1 ? "" : "S"}\n${this.totalReturned.toLocaleString("en-US")} CR WON`);
    }

    highlightRules() {
      this.tweens.add({ targets: this.rulesPanel, alpha: 0.45, duration: 160, yoyo: true, repeat: 2 });
      setStatus("Match three Ruby symbols or three Golden 7 symbols across the curved center line.");
    }

    resetDemo() {
      if (this.isSpinning) return;
      window.GamishAudio?.play("reset");
      this.credits = 1000;
      this.lastWin = 0;
      this.totalWagered = 0;
      this.totalReturned = 0;
      this.spinCount = 0;
      this.outcomeBags.clear();
      this.cycleText.setText(`EMBER SPIN  •  BET ${this.bet}`);
      this.resultText.setText("DEMO CREDITS RESTORED").setColor("#7af0b1");
      this.refreshHud();
      setStatus("Phoenix Ruby demo reset to 1,000 virtual credits. All shuffled outcome cycles were restarted.");
    }

    returnToHall() {
      if (this.isSpinning) return;
      this.cameras.main.fadeOut(320, 9, 4, 12);
      this.time.delayedCall(320, () => this.scene.start("GameZone"));
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: "game-shell",
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#08050c",
    transparent: false,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WIDTH,
      height: HEIGHT,
    },
    input: {
      activePointers: 3,
      smoothFactor: 0.2,
    },
    scene: [BootScene, LandingScene, GameZoneScene, PhoenixGameScene],
    callbacks: {
      postBoot: (game) => {
        game.canvas.setAttribute("role", "application");
        game.canvas.setAttribute("aria-label", "Gamish777 Ember Crown Arcade interactive game menu");
      },
    },
  };

  const start = () => {
    if (!window.Phaser) {
      setStatus("Unable to load the game engine. Please refresh and try again.");
      return;
    }
    new Phaser.Game(config);
  };

  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
})();
