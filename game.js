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
    { mark: "7", frame: "symbol-0", name: "Golden Seven" },
    { mark: "◆", frame: "symbol-1", name: "Ruby Diamond" },
    { mark: "♛", frame: "symbol-2", name: "Ember Crown" },
    { mark: "✦", frame: "symbol-3", name: "Ember Star" },
    { mark: "R", frame: "symbol-8", name: "Phoenix" },
  ];

  const HOW_TO_PLAY = [
    ["CHOOSE YOUR BET", "Select 10, 20, or 40 virtual credits."],
    ["TAP SPIN", "Watch the three reels reveal your fortune."],
    ["MATCH THE CENTER", "Three matching symbols across the center line win."],
    ["RUBY MATCH", "Three Ruby Diamonds return 1.5× your bet."],
    ["GOLDEN SEVEN", "Three Golden Sevens return 3× your bet."],
    ["FIND THE PHOENIX", "Rare Phoenix symbols build your Ember Collection."],
    ["BUILD YOUR COLLECTION", "Earn gems and unlock new Phoenix themes."],
  ];

  const secureRandom = () => {
    if (!window.crypto?.getRandomValues) return Math.random();
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] / 4294967296;
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
    const bar = addOrnatePanel(scene, WIDTH / 2, 70, WIDTH - 64, 92, {
      fill: COLORS.panel, fillAlpha: 0.84, stroke: COLORS.gold, strokeAlpha: 0.34, bend: 28,
    });

    if (options.back) {
      const back = scene.add.container(88, 70);
      const outerGlow = scene.add.circle(0, 0, 36, COLORS.ember, 0.09).setStrokeStyle(2, COLORS.ember, 0.25);
      const disk = scene.add.circle(0, 0, 31, 0x0e0912, 0.96).setStrokeStyle(2, COLORS.gold, 0.82);
      const arrow = scene.add.text(-2, -2, "‹", { fontFamily: BODY_FONT, fontSize: "49px", color: "#ffe4a3" }).setOrigin(0.5);
      back.add([outerGlow, disk, arrow]).setSize(82, 82).setInteractive({ useHandCursor: true });
      back.on("pointerup", () => {
        window.GamishAudio?.play("nav");
        options.back();
      });
      back.on("pointerover", () => scene.tweens.add({ targets: back, scale: 1.08, duration: 120 }));
      back.on("pointerout", () => scene.tweens.add({ targets: back, scale: 1, duration: 120 }));
      scene.tweens.add({ targets: outerGlow, alpha: { from: 0.18, to: 0.68 }, scale: { from: 0.92, to: 1.08 }, duration: 1000, yoyo: true, repeat: -1 });
    }

    scene.add.text(options.back ? 138 : 64, 70, options.title ?? "GAMISH777", {
      fontFamily: DISPLAY_FONT,
      fontSize: "24px",
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
      this.load.image("phoenix-realm-v2", "assets/phoenix-realm-bg-v2.webp");
      this.load.image("phoenix-symbols-v2", "assets/phoenix-symbols-v2.webp");
      this.load.image("phoenix-gameplay-v3", "assets/phoenix-gameplay-bg-v3.webp");
      this.load.image("phoenix-reel-frame-v3", "assets/phoenix-reel-frame-v3.webp");
    }

    create() {
      const symbolTexture = this.textures.get("phoenix-symbols-v2");
      const cell = 418;
      for (let index = 0; index < 9; index += 1) {
        const frameName = `symbol-${index}`;
        if (!symbolTexture.has(frameName)) {
          symbolTexture.add(frameName, 0, (index % 3) * cell, Math.floor(index / 3) * cell, cell, cell);
        }
      }
      document.getElementById("loading-fallback")?.classList.add("ready");
      this.scene.start("Landing");
    }
  }

  class LandingScene extends Phaser.Scene {
    constructor() {
      super("Landing");
    }

    create() {
      setStatus("Phoenix Ruby welcome. Review how to play, then enter the Phoenix Realm.");
      fitBackground(this, "phoenix-realm-v2");
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x08040b, 0.5);
      addVignette(this, 0.2);
      addAtmosphere(this, 38, [0xff6a18, 0xffca68, 0xe23435]);

      const crestGlow = this.add.circle(WIDTH / 2, 215, 160, COLORS.ember, 0.09).setBlendMode(Phaser.BlendModes.ADD);
      const crestRing = this.add.circle(WIDTH / 2, 215, 122, 0x130914, 0.7).setStrokeStyle(3, COLORS.gold, 0.82);
      const crest = this.add.image(WIDTH / 2, 215, "phoenix-symbols-v2", "symbol-8").setDisplaySize(225, 225);
      this.tweens.add({ targets: crestGlow, scale: 1.28, alpha: 0.24, duration: 1650, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: crest, y: 207, duration: 1900, ease: "Sine.InOut", yoyo: true, repeat: -1 });
      this.tweens.add({ targets: crestRing, angle: 360, duration: 22000, repeat: -1 });

      this.add.text(WIDTH / 2, 328, "PHOENIX RUBY", {
        fontFamily: DISPLAY_FONT,
        fontSize: "50px",
        color: "#fff2bf",
        stroke: "#7a1a08",
        strokeThickness: 8,
        shadow: { offsetY: 7, color: "#000000", blur: 14, fill: true },
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 384, "SPIN  ✦  COLLECT  ✦  RISE", {
        fontFamily: BODY_FONT,
        fontSize: "16px",
        fontStyle: "700",
        color: "#ffd38a",
        letterSpacing: 6,
      }).setOrigin(0.5);
      addRule(this, 428, 540);

      addOrnatePanel(this, WIDTH / 2, 825, 674, 720, {
        fill: 0x0d0711, fillAlpha: 0.91, stroke: COLORS.gold, strokeAlpha: 0.74, lineWidth: 3, bend: 48,
      });
      this.add.text(WIDTH / 2, 500, "HOW TO PLAY", {
        fontFamily: DISPLAY_FONT,
        fontSize: "27px",
        color: "#fff0bd",
        stroke: "#52150c",
        strokeThickness: 5,
        letterSpacing: 3,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 535, "Seven steps to awaken the Phoenix", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        color: "#cdb5ad",
        letterSpacing: 1,
      }).setOrigin(0.5);

      HOW_TO_PLAY.forEach(([title, copy], index) => {
        const y = 592 + index * 82;
        const badge = this.add.circle(102, y, 24, index < 5 ? 0x7c2016 : 0x3b1633, 0.96)
          .setStrokeStyle(2, index < 5 ? COLORS.gold : COLORS.ruby, 0.86);
        this.add.text(102, y + 1, String(index + 1), {
          fontFamily: DISPLAY_FONT,
          fontSize: "16px",
          color: "#fff0c2",
        }).setOrigin(0.5);
        this.add.text(145, y - 15, title, {
          fontFamily: BODY_FONT,
          fontSize: "15px",
          fontStyle: "700",
          color: index === 3 ? "#ff6778" : index === 4 ? "#ffd46d" : "#ffe8bd",
          letterSpacing: 2,
        });
        this.add.text(145, y + 10, copy, {
          fontFamily: BODY_FONT,
          fontSize: "14px",
          color: "#c7b5bb",
        });
        this.tweens.add({ targets: badge, alpha: { from: 0.72, to: 1 }, duration: 900 + index * 100, yoyo: true, repeat: -1 });
      });

      makeButton(this, WIDTH / 2, 1264, 520, 88, "ENTER THE PHOENIX REALM", () => {
        window.GamishAudio?.play("flame-burst");
        setStatus("Opening the Phoenix Realm.");
        this.cameras.main.flash(240, 255, 118, 32, false);
        this.cameras.main.fadeOut(420, 20, 7, 13);
        this.time.delayedCall(420, () => this.scene.start("GameZone"));
      }, { fill: 0x8d1f12, stroke: 0xffd87e, accent: 0xff5b12, fontSize: "21px" });

      this.add.text(WIDTH / 2, 1345, "VIRTUAL CREDITS  •  NO CASH VALUE", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#c4a486",
        letterSpacing: 3,
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

  class LegacyPhoenixGameScene extends Phaser.Scene {
    constructor() {
      super("LegacyPhoenixGame");
      this.credits = 0;
      this.bet = 10;
      this.lastWin = 0;
      this.totalWagered = 0;
      this.totalReturned = 0;
      this.spinCount = 0;
      this.isSpinning = false;
      this.reelTexts = [];
      this.reelBands = [];
      this.reelGlows = [];
      this.betButtons = new Map();
    }

    create() {
      this.reelTexts = [];
      this.reelBands = [];
      this.reelGlows = [];
      this.betButtons = new Map();
      this.isSpinning = false;
      this.credits = Number(window.GamishAccount?.player?.totalCredits || 0);
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
      const reelSurface = this.add.graphics();
      reelSurface.fillGradientStyle(0x33152f, 0x33152f, 0x09060e, 0x09060e, 0.72, 0.72, 0.98, 0.98);
      reelSurface.fillRoundedRect(74, 378, 620, 434, 48);
      addOrnatePanel(this, WIDTH / 2, 595, 622, 438, {
        fill: 0x09060e,
        fillAlpha: 0.08,
        stroke: 0xf0ad55,
        strokeAlpha: 0.46,
        lineWidth: 2,
        bend: 42,
        anchors: false,
      });

      reelXs.forEach((x, column) => {
        const band = this.add.rectangle(x, 595, 190, 412, column === 1 ? 0x50182d : 0x2f1328, column === 1 ? 0.2 : 0.14);
        band.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.72);
        this.reelBands.push(band);

        const glow = this.add.ellipse(x, 595, 170, 116, column === 1 ? COLORS.ember : COLORS.ruby, 0.055);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.reelGlows.push(glow);
      });

      const reelDetails = this.add.graphics();
      reelDetails.lineStyle(2, 0xd78b52, 0.26);
      [286, 482].forEach((x, index) => {
        reelDetails.beginPath();
        reelDetails.moveTo(x, 398);
        traceCubic(reelDetails,
          { x, y: 398 },
          { x: x + (index ? 8 : -8), y: 492 },
          { x: x + (index ? -8 : 8), y: 698 },
          { x, y: 792 },
          22);
        reelDetails.strokePath();
      });
      reelDetails.fillStyle(COLORS.gold, 0.38);
      reelXs.forEach((x) => {
        [397, 793].forEach((y) => {
          reelDetails.fillPoints([
            new Phaser.Geom.Point(x, y - 5),
            new Phaser.Geom.Point(x + 5, y),
            new Phaser.Geom.Point(x, y + 5),
            new Phaser.Geom.Point(x - 5, y),
          ]);
        });
      });

      this.add.rectangle(WIDTH / 2, 595, 600, 142, 0x8b1f2c, 0.1).setBlendMode(Phaser.BlendModes.ADD);
      reelYs.forEach((y, row) => {
        reelXs.forEach((x, column) => {
          const symbol = PHOENIX_SYMBOLS[(row * 2 + column) % PHOENIX_SYMBOLS.length];
          const text = this.add.text(x, y - 3, symbol.mark, {
            fontFamily: DISPLAY_FONT,
            fontSize: symbol.mark === "7" ? "74px" : "63px",
            color: symbol.color,
            stroke: "#3b0d0b",
            strokeThickness: 7,
            shadow: { offsetY: 6, color: "#000000", blur: 12, fill: true },
          }).setOrigin(0.5)
            .setData("baseY", y - 3)
            .setData("row", row)
            .setData("column", column);
          this.reelTexts.push(text);
        });
      });

      this.winLine = this.add.graphics();
      this.winLine.lineStyle(5, COLORS.gold, 0.44);
      this.winLine.beginPath();
      this.winLine.moveTo(82, 600);
      traceCubic(this.winLine, { x: 82, y: 600 }, { x: 220, y: 568 }, { x: 548, y: 622 }, { x: 686, y: 590 }, 28);
      this.winLine.strokePath();
      this.winLine.setBlendMode(Phaser.BlendModes.ADD);
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
      this.add.text(86, 1306, "Every spin settles through the secure player ledger", {
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

      makeButton(this, WIDTH / 2, 1368, 310, 54, "REFRESH WALLET", () => this.refreshAccountWallet(), {
        fill: 0x1b101b,
        stroke: 0x8a5b50,
        accent: 0x68424c,
        fontSize: "14px",
      });

      this.input.keyboard?.on("keydown-SPACE", () => this.spin());
      this.input.keyboard?.on("keydown-ESC", () => this.returnToHall());
      this.walletListener = (event) => {
        this.credits = Number(event.detail?.totalCredits || 0);
        this.refreshHud();
      };
      window.addEventListener("gamish:wallet", this.walletListener);
      this.events.once("shutdown", () => window.removeEventListener("gamish:wallet", this.walletListener));
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

    randomSymbol(excludedMark) {
      const choices = excludedMark ? PHOENIX_SYMBOLS.filter((symbol) => symbol.mark !== excludedMark) : PHOENIX_SYMBOLS;
      return choices[Math.floor(secureRandom() * choices.length)];
    }

    setSymbol(text, symbol) {
      text.setText(symbol.mark).setColor(symbol.color).setFontSize(symbol.mark === "7" ? 74 : 63);
    }

    symbolForMark(mark) {
      return PHOENIX_SYMBOLS.find((symbol) => symbol.mark === mark) || PHOENIX_SYMBOLS[1];
    }

    async spin() {
      if (this.isSpinning) return;
      if (this.credits < this.bet) {
        this.resultText.setText("NOT ENOUGH CREDITS — OPEN WALLET").setColor("#ff7f72");
        setStatus("Not enough virtual credits. Open Payments or ask an admin to add credits.");
        this.cameras.main.shake(160, 0.005);
        return;
      }

      this.isSpinning = true;
      this.spinButton.disableInteractive().setAlpha(0.72);
      this.resultText.setText("CHECKING WALLET…").setColor("#ffd58c");

      let round;
      try {
        const response = await window.GamishAccount.request("/api/game/spin", {
          method: "POST",
          body: JSON.stringify({ bet: this.bet }),
        });
        round = response.round;
      } catch (error) {
        this.isSpinning = false;
        this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
        this.resultText.setText(error.message.toUpperCase()).setColor("#ff7f72");
        setStatus(`Phoenix Ruby could not start the spin: ${error.message}`);
        return;
      }

      window.GamishAudio?.play("spin");
      this.credits = Math.max(0, this.credits - this.bet);
      this.totalWagered += this.bet;
      this.spinCount += 1;
      this.lastWin = 0;
      this.cycleText.setText(`EMBER CIRCLE  •  SPIN ${this.spinCount}  •  BET ${this.bet}`);
      this.resultText.setText("REELS IN MOTION…").setColor("#ffd58c");
      this.refreshHud();
      this.animateRound(round);
    }

    animateRound(round) {
      const grid = round.marks.map((mark) => this.symbolForMark(mark));

      let ticks = 0;
      const stopTicks = [10, 14, 18];
      const settled = [false, false, false];
      this.reelBands.forEach((band, column) => {
        this.tweens.add({
          targets: band,
          alpha: { from: 0.42, to: 1 },
          duration: 150 + column * 24,
          yoyo: true,
          repeat: 7,
        });
      });
      this.tweens.add({ targets: this.winLine, alpha: { from: 0.16, to: 0.62 }, duration: 220, yoyo: true, repeat: 5 });

      this.time.addEvent({
        delay: 74,
        repeat: 17,
        callback: () => {
          ticks += 1;
          this.reelTexts.forEach((text) => {
            const column = text.getData("column");
            const row = text.getData("row");
            if (ticks >= stopTicks[column]) return;
            this.setSymbol(text, this.randomSymbol());
            const travelStep = (ticks + row * 2) % 3;
            text
              .setY(text.getData("baseY") + [48, 2, -44][travelStep])
              .setAlpha(0.42 + travelStep * 0.13)
              .setScale(0.9, 1.22)
              .setAngle(travelStep === 1 ? 0 : (travelStep - 1) * 2);
          });

          stopTicks.forEach((stopTick, column) => {
            if (ticks !== stopTick || settled[column]) return;
            settled[column] = true;
            [column, column + 3, column + 6].forEach((index, row) => {
              const text = this.reelTexts[index];
              this.setSymbol(text, grid[index]);
              text
                .setY(text.getData("baseY") - 54)
                .setAlpha(0.5)
                .setScale(0.88, 1.16)
                .setAngle(0);
              this.tweens.add({
                targets: text,
                y: text.getData("baseY"),
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 250,
                delay: row * 34,
                ease: "Back.Out",
              });
            });
            this.tweens.add({
              targets: [this.reelBands[column], this.reelGlows[column]],
              alpha: { from: 0.32, to: 1 },
              duration: 150,
              yoyo: true,
            });
            window.GamishAudio?.play("tick");
            this.cameras.main.shake(70, 0.0015 + column * 0.0003);
          });

          if (ticks % 4 === 0 && ticks < stopTicks[2]) {
            window.GamishAudio?.play("tick");
            this.cameras.main.shake(42, 0.0009);
          }

          if (ticks === stopTicks[2]) this.time.delayedCall(380, () => this.finishSpin(round));
        },
      });
    }

    finishSpin(round) {
      const payout = Number(round.payout);
      const multiplier = Number(round.multiplier);
      this.lastWin = payout;
      this.credits = Number(round.wallet.totalCredits);
      this.totalReturned += payout;
      if (window.GamishAccount?.player) {
        Object.assign(window.GamishAccount.player, round.wallet);
        window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: window.GamishAccount.player }));
      }

      if (payout > 0) {
        window.GamishAudio?.play(multiplier === 3 ? "win-big" : "win-small");
        this.resultText.setText(`WIN  +${payout.toLocaleString("en-US")} CREDITS  •  ${multiplier}×`).setColor("#ffdc83");
        this.tweens.add({ targets: this.reelTexts.slice(3, 6), scale: 1.16, duration: 180, yoyo: true, repeat: 2 });
        this.tweens.add({ targets: this.reelGlows, alpha: { from: 0.2, to: 1 }, scaleX: 1.08, scaleY: 1.08, duration: 180, yoyo: true, repeat: 3 });
        this.tweens.add({ targets: this.winLine, alpha: 1, scaleX: 1.05, duration: 190, yoyo: true, repeat: 3 });
        this.cameras.main.flash(220, 255, 126, 34, false);
        setStatus(`Phoenix Ruby win. ${payout} virtual credits returned at ${multiplier} times the bet.`);
      } else {
        window.GamishAudio?.play("lose");
        this.resultText.setText("NO WIN  •  THE PHOENIX RISES AGAIN").setColor("#c4abb1");
        this.tweens.add({ targets: this.winLine, alpha: 0.3, duration: 260 });
        setStatus("Phoenix Ruby spin complete. No win on this virtual-credit spin.");
      }

      this.refreshHud();
      this.isSpinning = false;
      this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    }

    selectBet(amount) {
      if (this.isSpinning || this.bet === amount) return;
      this.bet = amount;
      this.betButtons.forEach((button, value) => {
        button.setAlpha(value === amount ? 1 : 0.7);
        this.tweens.add({ targets: button, scale: value === amount ? 1.045 : 1, duration: 140 });
      });
      this.cycleText.setText(`EMBER CIRCLE  •  SPIN ${this.spinCount}  •  BET ${amount}`);
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

    async refreshAccountWallet() {
      if (this.isSpinning) return;
      window.GamishAudio?.play("reset");
      try {
        const player = await window.GamishAccount.refreshWallet();
        this.credits = Number(player.totalCredits || 0);
        this.resultText.setText("WALLET REFRESHED").setColor("#7af0b1");
        this.refreshHud();
        setStatus(`Wallet refreshed. ${this.credits} virtual credits available.`);
      } catch (error) {
        this.resultText.setText("WALLET REFRESH FAILED").setColor("#ff7f72");
        setStatus(error.message);
      }
    }

    returnToHall() {
      if (this.isSpinning) return;
      this.cameras.main.fadeOut(320, 9, 4, 12);
      this.time.delayedCall(320, () => this.scene.start("GameZone"));
    }
  }

  class PhoenixGameScene extends Phaser.Scene {
    constructor() {
      super("PhoenixGame");
      this.credits = 0;
      this.bet = 10;
      this.lastWin = 0;
      this.totalReturned = 0;
      this.spinCount = 0;
      this.isSpinning = false;
      this.reelSymbols = [];
      this.reelBands = [];
      this.reelGlows = [];
      this.betButtons = new Map();
    }

    create() {
      this.reelSymbols = [];
      this.reelBands = [];
      this.reelGlows = [];
      this.betButtons = new Map();
      this.isSpinning = false;
      this.credits = Number(window.GamishAccount?.player?.totalCredits || 0);
      this.collection = this.loadCollection();
      setStatus("Phoenix Ruby. Choose 10, 20, or 40 credits and match the curved center line.");

      fitBackground(this, "phoenix-gameplay-v3");
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07030a, 0.38);
      addVignette(this, 0.12);
      addAtmosphere(this, 26, [0xff5b16, 0xffc457, 0xe0323d]);
      addTopBar(this, { title: "PHOENIX RUBY", back: () => this.returnToHall() });

      this.add.text(WIDTH / 2, 126, "EMBER CIRCLE", {
        fontFamily: DISPLAY_FONT,
        fontSize: "36px",
        color: "#fff0b9",
        stroke: "#741a08",
        strokeThickness: 7,
        letterSpacing: 4,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 166, "SPIN  ✦  COLLECT  ✦  RISE", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#eac184",
        letterSpacing: 5,
      }).setOrigin(0.5);

      this.creditText = this.addStatCard(112, 232, "CREDITS", "0", 166);
      this.betText = this.addStatCard(294, 232, "BET", "10", 166);
      this.winText = this.addStatCard(476, 232, "WIN", "0", 166);
      this.totalWinText = this.addStatCard(658, 232, "TOTAL WIN", "0", 166, true);

      const machineGlow = addOrnatePanel(this, WIDTH / 2, 555, 720, 512, {
        fill: COLORS.ember, fillAlpha: 0.06, stroke: COLORS.ember, strokeAlpha: 0.18, bend: 58,
      });
      this.machinePanel = addOrnatePanel(this, WIDTH / 2, 555, 692, 484, {
        fill: 0x0c0710, fillAlpha: 0.96, stroke: COLORS.gold, strokeAlpha: 0.42, lineWidth: 2, bend: 50,
      });
      this.tweens.add({ targets: machineGlow, alpha: { from: 0.28, to: 0.92 }, duration: 1200, yoyo: true, repeat: -1 });

      this.cycleText = this.add.text(WIDTH / 2, 342, "EMBER CIRCLE  •  BET 10", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#ffd38a",
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(5);

      const reelXs = [190, 384, 578];
      const reelYs = [420, 552, 684];
      const reelSurface = this.add.graphics();
      reelSurface.fillGradientStyle(0x30142b, 0x30142b, 0x08050c, 0x08050c, 0.82, 0.82, 0.98, 0.98);
      reelSurface.fillRoundedRect(82, 350, 604, 404, 38);
      reelSurface.lineStyle(2, 0x9a593d, 0.46);
      reelSurface.strokeRoundedRect(82, 350, 604, 404, 38);

      reelXs.forEach((x, column) => {
        const band = this.add.rectangle(x, 552, 188, 392, column === 1 ? 0x7a1b2e : 0x361127, column === 1 ? 0.16 : 0.11);
        band.setBlendMode(Phaser.BlendModes.ADD);
        this.reelBands.push(band);
        const glow = this.add.ellipse(x, 552, 168, 128, column === 1 ? COLORS.ember : COLORS.ruby, 0.06)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.reelGlows.push(glow);
      });

      reelYs.forEach((y, row) => {
        reelXs.forEach((x, column) => {
          const symbol = PHOENIX_SYMBOLS[(row * 2 + column) % PHOENIX_SYMBOLS.length];
          const halo = this.add.circle(x, y, 63, row === 1 ? COLORS.ember : COLORS.gold, row === 1 ? 0.055 : 0.025)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
          const image = this.add.image(x, y, "phoenix-symbols-v2", symbol.frame)
            .setDisplaySize(132, 132)
            .setDepth(2)
            .setData("baseY", y)
            .setData("row", row)
            .setData("column", column)
            .setData("halo", halo);
          this.reelSymbols.push(image);
        });
      });

      this.reelFrame = this.add.image(WIDTH / 2, 552, "phoenix-reel-frame-v3")
        .setDisplaySize(724, 454)
        .setDepth(3);
      this.add.text(WIDTH / 2, 758, "PHOENIX RUBY", {
        fontFamily: DISPLAY_FONT,
        fontSize: "14px",
        color: "#fff0b4",
        stroke: "#6c1608",
        strokeThickness: 4,
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(5);

      this.centerBand = this.add.rectangle(WIDTH / 2, 552, 592, 126, 0x9b1625, 0.09)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      this.winLine = this.add.graphics();
      this.drawWinLine(0.56);
      this.winLine.setBlendMode(Phaser.BlendModes.ADD).setDepth(4);

      addOrnatePanel(this, WIDTH / 2, 804, 610, 58, {
        fill: 0x170a14, fillAlpha: 0.96, stroke: COLORS.gold, strokeAlpha: 0.4, bend: 18,
      });
      this.resultText = this.add.text(WIDTH / 2, 804, "PRESS SPIN TO BEGIN", {
        fontFamily: BODY_FONT,
        fontSize: "15px",
        fontStyle: "700",
        color: "#d9c2ac",
        letterSpacing: 3,
      }).setOrigin(0.5);

      this.spinButton = makeButton(this, WIDTH / 2, 894, 544, 92, "SPIN  •  10 CREDITS", () => this.spin(), {
        fill: 0x9b2014,
        stroke: 0xffdc7b,
        accent: 0xff5c14,
        fontSize: "25px",
      });

      this.add.text(78, 962, "CHOOSE YOUR BET", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#d4ae75",
        letterSpacing: 3,
      });
      PHOENIX_BETS.forEach((amount, index) => {
        const button = makeButton(this, 200 + index * 184, 1008, 154, 58, `${amount} CR`, () => this.selectBet(amount), {
          fill: amount === this.bet ? 0x7e1915 : 0x1b0c18,
          stroke: amount === this.bet ? COLORS.gold : 0x784446,
          accent: amount === this.bet ? COLORS.ember : 0x5b3142,
          fontSize: "16px",
        });
        if (amount !== this.bet) button.setAlpha(0.72);
        this.betButtons.set(amount, button);
      });

      this.add.text(78, 1062, "PHOENIX FLAME", {
        fontFamily: BODY_FONT,
        fontSize: "11px",
        fontStyle: "700",
        color: "#e8b765",
        letterSpacing: 3,
      });
      this.flameValueText = this.add.text(690, 1062, "0%", {
        fontFamily: BODY_FONT,
        fontSize: "11px",
        fontStyle: "700",
        color: "#ffd87e",
      }).setOrigin(1, 0);
      this.flameSegments = Array.from({ length: 10 }, (_, index) => this.add.rectangle(92 + index * 59, 1093, 48, 22, 0x4a2524, 0.72)
        .setStrokeStyle(1, 0xd57132, 0.34));
      this.flameMarker = this.add.image(688, 1093, "phoenix-symbols-v2", "symbol-4").setDisplaySize(52, 52);

      this.collectionPanel = addOrnatePanel(this, WIDTH / 2, 1190, 650, 176, {
        fill: 0x0f0812, fillAlpha: 0.96, stroke: COLORS.gold, strokeAlpha: 0.5, bend: 36,
      });
      this.add.image(118, 1181, "phoenix-symbols-v2", "symbol-8").setDisplaySize(88, 88);
      this.add.text(176, 1136, "EMBER COLLECTION", {
        fontFamily: BODY_FONT,
        fontSize: "13px",
        fontStyle: "700",
        color: "#f0c475",
        letterSpacing: 3,
      });
      this.themeText = this.add.text(176, 1166, "PHOENIX THEME  •  EMBER", {
        fontFamily: DISPLAY_FONT,
        fontSize: "19px",
        color: "#fff0bd",
      });
      this.collectionTrack = this.add.rectangle(176, 1208, 460, 18, 0x2e2030, 0.94).setOrigin(0, 0.5);
      this.collectionSegments = Array.from({ length: 10 }, (_, index) => this.add.rectangle(180 + index * 45, 1208, 38, 12, 0x4f285d, 0.76)
        .setOrigin(0, 0.5));
      this.collectionMarker = this.add.image(176, 1208, "phoenix-symbols-v2", "symbol-1").setDisplaySize(34, 34);
      this.collectionText = this.add.text(636, 1242, "0 / 10 GEMS", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#e8c792",
        letterSpacing: 2,
      }).setOrigin(1, 0.5);
      this.add.text(176, 1242, "Find Phoenix crests to unlock the next theme", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        color: "#bbaab1",
      }).setOrigin(0, 0.5);

      makeButton(this, 262, 1320, 310, 58, "REFRESH WALLET", () => this.refreshAccountWallet(), {
        fill: 0x1a0d19, stroke: 0x8a574c, accent: 0x673742, fontSize: "13px",
      });
      makeButton(this, 534, 1320, 190, 58, "HOW TO PLAY", () => this.highlightRules(), {
        fill: 0x321125, stroke: 0x9e624e, accent: COLORS.ruby, fontSize: "12px",
      });
      this.sessionText = this.add.text(WIDTH / 2, 1392, "0 SPINS  •  0 CREDITS WON", {
        fontFamily: BODY_FONT,
        fontSize: "12px",
        fontStyle: "700",
        color: "#caa47e",
        letterSpacing: 3,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 1436, "RUBY 1.5×   •   GOLDEN SEVEN 3×   •   CENTER LINE WINS", {
        fontFamily: BODY_FONT,
        fontSize: "11px",
        fontStyle: "700",
        color: "#aa929a",
        letterSpacing: 2,
      }).setOrigin(0.5);

      this.refreshCollection(false);
      this.refreshHud();
      this.input.keyboard?.on("keydown-SPACE", () => this.spin());
      this.input.keyboard?.on("keydown-ESC", () => this.returnToHall());
      this.walletListener = (event) => {
        this.credits = Number(event.detail?.totalCredits || 0);
        this.refreshHud();
      };
      window.addEventListener("gamish:wallet", this.walletListener);
      this.events.once("shutdown", () => window.removeEventListener("gamish:wallet", this.walletListener));
      this.cameras.main.fadeIn(500, 8, 4, 10);
    }

    addStatCard(x, y, label, value, width = 198, winged = false) {
      addOrnatePanel(this, x, y, width, 86, {
        fill: winged ? 0x2b0b12 : 0x0f0812,
        fillAlpha: 0.95,
        stroke: winged ? COLORS.gold : 0xa46646,
        strokeAlpha: winged ? 0.9 : 0.72,
        bend: 22,
      });
      if (winged) {
        this.add.image(x - width / 2 + 19, y + 5, "phoenix-symbols-v2", "symbol-4").setDisplaySize(40, 40).setAngle(-24);
        this.add.image(x + width / 2 - 19, y + 5, "phoenix-symbols-v2", "symbol-4").setDisplaySize(40, 40).setAngle(24).setFlipX(true);
      }
      this.add.text(x, y - 20, label, {
        fontFamily: BODY_FONT,
        fontSize: label === "TOTAL WIN" ? "9px" : "11px",
        fontStyle: "700",
        color: "#bca092",
        letterSpacing: 3,
      }).setOrigin(0.5);
      return this.add.text(x, y + 14, value, {
        fontFamily: DISPLAY_FONT,
        fontSize: width < 180 ? "20px" : "24px",
        color: "#ffe9ae",
      }).setOrigin(0.5);
    }

    drawWinLine(alpha = 0.56) {
      this.winLine.clear();
      this.winLine.lineStyle(10, 0x9f2b20, alpha * 0.35);
      this.winLine.beginPath();
      this.winLine.moveTo(86, 555);
      traceCubic(this.winLine, { x: 86, y: 555 }, { x: 230, y: 533 }, { x: 538, y: 570 }, { x: 682, y: 549 }, 30);
      this.winLine.strokePath();
      this.winLine.lineStyle(4, COLORS.gold, alpha);
      this.winLine.beginPath();
      this.winLine.moveTo(86, 555);
      traceCubic(this.winLine, { x: 86, y: 555 }, { x: 230, y: 533 }, { x: 538, y: 570 }, { x: 682, y: 549 }, 30);
      this.winLine.strokePath();
    }

    randomSymbol(excludedMark) {
      const choices = excludedMark ? PHOENIX_SYMBOLS.filter((symbol) => symbol.mark !== excludedMark) : PHOENIX_SYMBOLS;
      return choices[Math.floor(secureRandom() * choices.length)];
    }

    symbolForMark(mark) {
      return PHOENIX_SYMBOLS.find((symbol) => symbol.mark === mark) || PHOENIX_SYMBOLS[1];
    }

    setSymbol(image, symbol) {
      image.setFrame(symbol.frame).setDisplaySize(132, 132);
    }

    async spin() {
      if (this.isSpinning) return;
      if (this.credits < this.bet) {
        this.resultText.setText("NOT ENOUGH CREDITS  •  OPEN WALLET").setColor("#ff8277");
        setStatus("Not enough virtual credits. Open Payments or ask an admin to add credits.");
        this.cameras.main.shake(170, 0.005);
        window.GamishAudio?.play("lose");
        return;
      }

      this.isSpinning = true;
      this.spinButton.disableInteractive().setAlpha(0.66);
      this.resultText.setText("CHECKING WALLET…").setColor("#ffd48b");
      let round;
      try {
        const response = await window.GamishAccount.request("/api/game/spin", {
          method: "POST",
          body: JSON.stringify({ bet: this.bet }),
        });
        round = response.round;
      } catch (error) {
        this.isSpinning = false;
        this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
        this.resultText.setText(error.message.toUpperCase()).setColor("#ff8277");
        setStatus(`Phoenix Ruby could not start the spin: ${error.message}`);
        return;
      }

      window.GamishAudio?.play("reel-start");
      this.credits = Math.max(0, this.credits - this.bet);
      this.spinCount += 1;
      this.lastWin = 0;
      this.cycleText.setText(`EMBER CIRCLE  •  SPIN ${this.spinCount}  •  BET ${this.bet}`);
      this.resultText.setText("REELS IN MOTION…").setColor("#ffd48b");
      this.refreshHud();
      this.animateRound(round);
    }

    animateRound(round) {
      const grid = round.marks.map((mark) => this.symbolForMark(mark));
      const stopTicks = [18, 24, 31];
      const settled = [false, false, false];
      let ticks = 0;

      this.drawWinLine(0.24);
      this.tweens.add({ targets: this.centerBand, alpha: { from: 0.3, to: 1 }, duration: 180, yoyo: true, repeat: 8 });
      this.reelBands.forEach((band, column) => {
        this.tweens.add({
          targets: band,
          alpha: { from: 0.35, to: 1 },
          duration: 108 + column * 18,
          yoyo: true,
          repeat: 12,
        });
      });

      this.time.addEvent({
        delay: 58,
        repeat: stopTicks[2] - 1,
        callback: () => {
          ticks += 1;
          this.reelSymbols.forEach((image) => {
            const column = image.getData("column");
            const row = image.getData("row");
            if (ticks >= stopTicks[column]) return;
            this.setSymbol(image, this.randomSymbol());
            const phase = (ticks + row) % 4;
            const offset = [-66, -18, 32, 72][phase];
            const baseScale = 132 / 418;
            image
              .setY(image.getData("baseY") + offset)
              .setAlpha(0.38 + phase * 0.12)
              .setScale(baseScale * 0.88, baseScale * 1.28)
              .setAngle(phase === 2 ? 0 : (phase - 1.5) * 2.5);
          });

          stopTicks.forEach((stopTick, column) => {
            if (ticks !== stopTick || settled[column]) return;
            settled[column] = true;
            [column, column + 3, column + 6].forEach((index, row) => {
              const image = this.reelSymbols[index];
              this.setSymbol(image, grid[index]);
              const baseScale = 132 / 418;
              image.setY(image.getData("baseY") - 82).setAlpha(0.34).setScale(baseScale * 0.86, baseScale * 1.34).setAngle(0);
              this.tweens.add({
                targets: image,
                y: image.getData("baseY"),
                alpha: 1,
                scaleX: baseScale,
                scaleY: baseScale,
                duration: 310,
                delay: row * 38,
                ease: "Back.Out",
              });
            });
            this.tweens.add({
              targets: [this.reelBands[column], this.reelGlows[column]],
              alpha: { from: 0.26, to: 1 },
              scaleX: { from: 0.96, to: 1.08 },
              duration: 170,
              yoyo: true,
            });
            window.GamishAudio?.play("reel-stop");
            this.cameras.main.shake(72, 0.0016 + column * 0.00035);
          });

          if (ticks % 3 === 0 && ticks < stopTicks[2]) window.GamishAudio?.play("reel-roll");
          if (ticks === stopTicks[2]) this.time.delayedCall(470, () => this.finishSpin(round));
        },
      });
    }

    finishSpin(round) {
      const payout = Number(round.payout);
      const multiplier = Number(round.multiplier);
      const phoenixFound = round.marks.filter((mark) => mark === "R").length;
      this.lastWin = payout;
      this.credits = Number(round.wallet.totalCredits);
      this.totalReturned += payout;
      if (window.GamishAccount?.player) {
        Object.assign(window.GamishAccount.player, round.wallet);
        window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: window.GamishAccount.player }));
      }
      if (phoenixFound > 0) this.collectPhoenix(phoenixFound);

      if (payout > 0) {
        const title = this.winTier(multiplier, payout);
        this.resultText.setText(`${title}  •  +${payout.toLocaleString("en-US")} CREDITS`).setColor("#ffe080");
        this.drawWinLine(1);
        this.tweens.add({ targets: this.reelSymbols.slice(3, 6), scale: (132 / 418) * 1.17, duration: 180, yoyo: true, repeat: 3 });
        this.tweens.add({ targets: this.reelGlows, alpha: { from: 0.18, to: 1 }, scaleX: 1.2, scaleY: 1.2, duration: 190, yoyo: true, repeat: 4 });
        this.cameras.main.flash(240, 255, 116, 24, false);
        window.GamishAudio?.play(multiplier === 3 ? "win-big" : "win-small");
        this.time.delayedCall(110, () => window.GamishAudio?.play("coin-shower"));
        this.time.delayedCall(220, () => window.GamishAudio?.play("flame-burst"));
        this.showWinCelebration(title, payout, multiplier);
        setStatus(`${title}. ${payout} virtual credits returned at ${multiplier} times the bet.`);
      } else {
        window.GamishAudio?.play(phoenixFound > 0 ? "collection" : "lose");
        if (phoenixFound > 0) {
          this.resultText.setText(`PHOENIX FOUND  •  +${phoenixFound} COLLECTION GEM${phoenixFound === 1 ? "" : "S"}`).setColor("#ffba61");
          setStatus(`Phoenix found. ${phoenixFound} collection gem${phoenixFound === 1 ? "" : "s"} added.`);
        } else {
          this.resultText.setText("NO CENTER MATCH  •  THE PHOENIX RISES AGAIN").setColor("#c5abb4");
          setStatus("Phoenix Ruby spin complete. No center-line win on this virtual-credit spin.");
        }
        this.time.delayedCall(300, () => this.unlockSpin());
      }
      this.refreshHud();
    }

    winTier(multiplier, payout) {
      const ratio = this.bet > 0 ? payout / this.bet : multiplier;
      if (ratio >= 10) return "MEGA WIN";
      if (ratio >= 5) return "SUPER WIN";
      if (ratio >= 3) return "BIG WIN";
      return "NICE WIN";
    }

    showWinCelebration(title, payout, multiplier) {
      const overlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(120).setAlpha(0);
      const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050207, 0.82).setInteractive();
      const glow = this.add.circle(0, -80, 250, multiplier === 3 ? 0xff8c18 : 0xd62f44, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      const leftFlame = this.add.image(-218, -110, "phoenix-symbols-v2", "symbol-8").setDisplaySize(260, 260).setAlpha(0.82);
      const rightFlame = this.add.image(218, -110, "phoenix-symbols-v2", "symbol-8").setDisplaySize(260, 260).setFlipX(true).setAlpha(0.82);
      const panel = addOrnatePanel(this, 0, 120, 610, 430, {
        fill: 0x160911, fillAlpha: 0.98, stroke: COLORS.gold, strokeAlpha: 0.95, lineWidth: 4, bend: 52,
      });
      const icon = this.add.image(0, -42, "phoenix-symbols-v2", multiplier === 3 ? "symbol-0" : "symbol-1").setDisplaySize(230, 230);
      const heading = this.add.text(0, 104, title, {
        fontFamily: DISPLAY_FONT,
        fontSize: multiplier === 3 ? "45px" : "48px",
        color: "#fff0a8",
        stroke: "#8b1c08",
        strokeThickness: 8,
        shadow: { offsetY: 8, color: "#000000", blur: 18, fill: true },
      }).setOrigin(0.5);
      const amount = this.add.text(0, 177, `+${payout.toLocaleString("en-US")}`, {
        fontFamily: DISPLAY_FONT,
        fontSize: "55px",
        color: "#ffd461",
        stroke: "#6c1608",
        strokeThickness: 7,
      }).setOrigin(0.5);
      const caption = this.add.text(0, 231, "VIRTUAL CREDITS WON", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        fontStyle: "700",
        color: "#f2c989",
        letterSpacing: 5,
      }).setOrigin(0.5);
      let closed = false;
      const closeCelebration = () => {
        if (closed) return;
        closed = true;
        window.GamishAudio?.play("tap");
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          scale: 1.04,
          duration: 260,
          onComplete: () => {
            overlay.destroy(true);
            this.unlockSpin();
          },
        });
      };
      const collectButton = makeButton(this, 0, 308, 390, 70, "COLLECT", closeCelebration, {
        fill: 0xa51f16,
        stroke: 0xffdc7b,
        accent: 0xff5c14,
        fontSize: "21px",
      });
      overlay.add([shade, glow, leftFlame, rightFlame, panel, icon, heading, amount, caption, collectButton]);

      for (let index = 0; index < 24; index += 1) {
        const coin = this.add.image(Phaser.Math.Between(-340, 340), Phaser.Math.Between(-850, -460), "phoenix-symbols-v2", "symbol-7")
          .setDisplaySize(Phaser.Math.Between(38, 66), Phaser.Math.Between(38, 66))
          .setAngle(Phaser.Math.Between(-70, 70));
        overlay.add(coin);
        this.tweens.add({
          targets: coin,
          y: Phaser.Math.Between(430, 820),
          x: coin.x + Phaser.Math.Between(-90, 90),
          angle: coin.angle + Phaser.Math.Between(240, 720),
          alpha: { from: 1, to: 0.15 },
          duration: Phaser.Math.Between(1450, 2200),
          delay: Phaser.Math.Between(0, 440),
          ease: "Cubic.In",
        });
      }

      this.tweens.add({ targets: overlay, alpha: 1, scale: { from: 0.88, to: 1 }, duration: 320, ease: "Back.Out" });
      this.tweens.add({ targets: glow, scale: { from: 0.82, to: 1.25 }, alpha: { from: 0.12, to: 0.34 }, duration: 700, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: [leftFlame, rightFlame], y: { from: -78, to: -125 }, alpha: { from: 0.5, to: 0.95 }, duration: 640, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: icon, scale: { from: icon.scaleX * 0.72, to: icon.scaleX }, angle: { from: -5, to: 0 }, duration: 520, ease: "Back.Out" });
      this.time.delayedCall(4200, closeCelebration);
    }

    unlockSpin() {
      this.isSpinning = false;
      this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    }

    selectBet(amount) {
      if (this.isSpinning || this.bet === amount) return;
      this.bet = amount;
      this.betButtons.forEach((button, value) => {
        button.setAlpha(value === amount ? 1 : 0.7);
        this.tweens.add({ targets: button, scale: value === amount ? 1.06 : 1, duration: 150, ease: "Back.Out" });
      });
      this.cycleText.setText(`EMBER CIRCLE  •  SPIN ${this.spinCount}  •  BET ${amount}`);
      this.refreshHud();
      window.GamishAudio?.play("chip");
      setStatus(`Phoenix Ruby bet set to ${amount} virtual credits.`);
    }

    refreshHud() {
      this.creditText?.setText(this.credits.toLocaleString("en-US"));
      this.betText?.setText(this.bet.toLocaleString("en-US"));
      this.winText?.setText(this.lastWin.toLocaleString("en-US"));
      this.totalWinText?.setText(this.totalReturned.toLocaleString("en-US"));
      this.spinButton?.getAt(3)?.setText(`SPIN  •  ${this.bet} CREDITS`);
      this.sessionText?.setText(`${this.spinCount} SPIN${this.spinCount === 1 ? "" : "S"}  •  ${this.totalReturned.toLocaleString("en-US")} CREDITS WON`);
      const momentum = this.spinCount === 0 ? 0 : (this.spinCount % 10 || 10);
      this.flameValueText?.setText(`${momentum * 10}%`);
      this.flameSegments?.forEach((segment, index) => {
        segment.setFillStyle(index < momentum ? (index > 6 ? 0xffc33e : 0xe64a23) : 0x4a2524, index < momentum ? 1 : 0.72);
      });
      if (this.flameMarker) {
        const targetX = 92 + Math.max(0, momentum - 1) * 59;
        this.tweens.add({ targets: this.flameMarker, x: targetX, duration: 360, ease: "Cubic.Out" });
      }
    }

    collectionStorageKey() {
      const playerId = window.GamishAccount?.player?.loginId || window.GamishAccount?.player?.id || "player";
      return `gamish777-phoenix-collection-${playerId}`;
    }

    loadCollection() {
      try {
        const stored = JSON.parse(window.localStorage.getItem(this.collectionStorageKey()) || "null");
        return {
          gems: Phaser.Math.Clamp(Number(stored?.gems) || 0, 0, 9),
          theme: Math.max(0, Number(stored?.theme) || 0),
        };
      } catch {
        return { gems: 0, theme: 0 };
      }
    }

    collectPhoenix(amount) {
      const total = this.collection.gems + amount;
      const levels = Math.floor(total / 10);
      this.collection.gems = total % 10;
      this.collection.theme += levels;
      try {
        window.localStorage.setItem(this.collectionStorageKey(), JSON.stringify(this.collection));
      } catch {
        // Collection still works for this session when storage is unavailable.
      }
      this.refreshCollection(true);
      if (levels > 0) {
        window.GamishAudio?.play("theme-unlock");
        this.resultText.setText("NEW PHOENIX THEME UNLOCKED").setColor("#ffdd73");
      }
    }

    refreshCollection(animate = true) {
      const themes = ["EMBER", "CRIMSON", "SOLAR", "ROYAL", "ASCENDANT"];
      const theme = themes[Math.min(this.collection.theme, themes.length - 1)];
      this.themeText?.setText(`PHOENIX THEME  •  ${theme}`);
      this.collectionText?.setText(`${this.collection.gems} / 10 GEMS`);
      if (!this.collectionSegments) return;
      this.collectionSegments.forEach((segment, index) => {
        segment.setFillStyle(index < this.collection.gems ? 0xd94ce4 : 0x4f285d, index < this.collection.gems ? 1 : 0.76);
      });
      const markerX = 176 + this.collection.gems * 45;
      if (animate) {
        this.tweens.add({ targets: this.collectionMarker, x: markerX, scale: { from: 0.07, to: 34 / 418 }, duration: 520, ease: "Back.Out" });
        this.tweens.add({ targets: this.collectionPanel, alpha: { from: 0.45, to: 1 }, duration: 220, yoyo: true, repeat: 1 });
      } else {
        this.collectionMarker.x = markerX;
      }
    }

    highlightRules() {
      this.tweens.add({ targets: this.collectionPanel, alpha: { from: 0.42, to: 1 }, duration: 200, yoyo: true, repeat: 2 });
      this.resultText.setText("MATCH 3 ON CENTER  •  RUBY 1.5×  •  SEVEN 3×").setColor("#ffdc82");
      setStatus("Choose 10, 20, or 40 credits. Match three Ruby Diamonds or Golden Sevens across the center line. Phoenix crests build your collection.");
    }

    async refreshAccountWallet() {
      if (this.isSpinning) return;
      window.GamishAudio?.play("reset");
      try {
        const player = await window.GamishAccount.refreshWallet();
        this.credits = Number(player.totalCredits || 0);
        this.resultText.setText("WALLET REFRESHED").setColor("#79efaf");
        this.refreshHud();
        setStatus(`Wallet refreshed. ${this.credits} virtual credits available.`);
      } catch (error) {
        this.resultText.setText("WALLET REFRESH FAILED").setColor("#ff8176");
        setStatus(error.message);
      }
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
