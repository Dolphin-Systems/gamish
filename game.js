(() => {
  "use strict";

  const WIDTH = 768;
  const HEIGHT = 1536;
  // Scenes are laid out on a 768×1536 design area. On phones the canvas takes the screen's exact
  // aspect ratio and each camera centres the design area inside the safe area, so background art
  // fills the whole screen instead of leaving letterbox bars.
  const MAX_HEIGHT = 2100;
  const BLEED = 700;
  const NAV_CLEARANCE = 58; // CSS px taken by the sound/wallet/chat bar below the safe area.
  const VIEW = { width: WIDTH, height: HEIGHT, left: 0, top: 0 };

  const readSafeInsets = () => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const insets = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
    probe.remove();
    return insets;
  };

  // Size the canvas to the phone's exact aspect ratio so it fills the screen with no bars.
  // Tall phones gain height; short phones gain width and a strip under the utility bar.
  const measureView = () => {
    const shell = document.getElementById("game-shell");
    const cssWidth = shell?.clientWidth || window.innerWidth;
    const cssHeight = shell?.clientHeight || window.innerHeight;
    if (!cssWidth || !cssHeight || window.innerWidth >= 820) return { width: WIDTH, height: HEIGHT, left: 0, top: 0 };
    const insets = readSafeInsets();
    const widthScale = cssWidth / WIDTH;
    const tallHeight = WIDTH * cssHeight / cssWidth;
    if (tallHeight >= HEIGHT + (insets.top + insets.bottom) / widthScale) {
      const height = Math.min(Math.round(tallHeight), MAX_HEIGHT);
      const safeTop = insets.top / widthScale;
      const safeBottom = insets.bottom / widthScale;
      return { width: WIDTH, height, left: 0, top: Math.round(safeTop + (height - HEIGHT - safeTop - safeBottom) / 2) };
    }
    const reserveTop = insets.top + NAV_CLEARANCE;
    const scale = Math.min(widthScale, (cssHeight - reserveTop - insets.bottom) / HEIGHT);
    const width = Math.round(cssWidth / scale);
    const height = Math.round(cssHeight / scale);
    const spare = height - HEIGHT - (reserveTop + insets.bottom) / scale;
    return { width, height, left: Math.round((width - WIDTH) / 2), top: Math.round(reserveTop / scale + spare / 2) };
  };

  const placeBackground = (image) => {
    const source = image.texture.getSourceImage();
    image.setPosition(VIEW.width / 2 - VIEW.left, VIEW.height / 2 - VIEW.top);
    image.setScale(Math.max(VIEW.width / source.width, VIEW.height / source.height));
  };

  const applyView = (scene) => {
    const camera = scene.cameras.main;
    camera.setSize(VIEW.width, VIEW.height);
    camera.setScroll(-VIEW.left, -VIEW.top);
    scene.backgrounds?.forEach(placeBackground);
  };

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
    ["symbol-4", "SWIPE OR TAP SPIN", "Bet 10, 20, or 40 virtual credits.", "#ffe8bd"],
    ["symbol-1", "RUBY DIAMONDS  ×1.5", "Three on the center line.", "#ff7d8c"],
    ["symbol-0", "GOLDEN SEVENS  ×3", "Three on the center line.", "#ffd46d"],
    ["symbol-8", "COLLECT THE PHOENIX", "10 crests unlock a new realm theme.", "#ffba61"],
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
    if (!scene.backgrounds || !scene.backgrounds[0]?.active) scene.backgrounds = [];
    scene.backgrounds.push(image);
    applyView(scene);
    return image;
  };

  const addAtmosphere = (scene, count = 34, palette = [0xff7a1a, 0xffca6d]) => {
    for (let i = 0; i < count; i += 1) {
      const radius = Phaser.Math.Between(2, 6);
      const ember = scene.add.circle(
        Phaser.Math.Between(20, WIDTH - 20),
        Phaser.Math.Between(100, HEIGHT + 220),
        radius,
        Phaser.Utils.Array.GetRandom(palette),
        Phaser.Math.FloatBetween(0.18, 0.62)
      );
      ember.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: ember,
        y: -260,
        x: ember.x + Phaser.Math.Between(-80, 80),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(0.2, 0.7),
        duration: Phaser.Math.Between(6000, 12000),
        delay: Phaser.Math.Between(0, 6000),
        repeat: -1,
        onRepeat: () => {
          ember.setPosition(Phaser.Math.Between(20, WIDTH - 20), HEIGHT + Phaser.Math.Between(120, 300));
          ember.setAlpha(Phaser.Math.FloatBetween(0.18, 0.62));
        },
      });
    }
  };

  const addVignette = (scene, alpha = 0.45) => {
    scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x07040b, alpha).setBlendMode(Phaser.BlendModes.MULTIPLY);
    addEdgeShade(scene);
  };

  // Soft top and bottom fades keep header and footer text readable without hard bands.
  const addEdgeShade = (scene, top = 0.7, bottom = 0.75) => {
    const shade = scene.add.graphics();
    shade.fillStyle(0x07040b, top);
    shade.fillRect(-BLEED, -BLEED, WIDTH + BLEED * 2, BLEED);
    shade.fillGradientStyle(0x07040b, 0x07040b, 0x07040b, 0x07040b, top, top, 0, 0);
    shade.fillRect(-BLEED, 0, WIDTH + BLEED * 2, 240);
    shade.fillGradientStyle(0x07040b, 0x07040b, 0x07040b, 0x07040b, 0, 0, bottom, bottom);
    shade.fillRect(-BLEED, HEIGHT - 300, WIDTH + BLEED * 2, 300);
    shade.fillStyle(0x07040b, bottom);
    shade.fillRect(-BLEED, HEIGHT, WIDTH + BLEED * 2, BLEED);
    return shade;
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
    // Kept to the left half so the page's sound, wallet and chat buttons can sit top-right.
    const bar = addOrnatePanel(scene, 212, 70, 360, 88, {
      fill: COLORS.panel, fillAlpha: 0.88, stroke: COLORS.gold, strokeAlpha: 0.4, bend: 28, anchors: false,
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
      applyView(this);
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
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x08040b, 0.5);
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

      addOrnatePanel(this, WIDTH / 2, 800, 660, 600, {
        fill: 0x0d0711, fillAlpha: 0.9, stroke: COLORS.gold, strokeAlpha: 0.7, lineWidth: 3, bend: 48,
      });
      this.add.text(WIDTH / 2, 552, "HOW TO PLAY", {
        fontFamily: DISPLAY_FONT,
        fontSize: "27px",
        color: "#fff0bd",
        stroke: "#52150c",
        strokeThickness: 5,
        letterSpacing: 3,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 590, "Four steps to awaken the Phoenix", {
        fontFamily: BODY_FONT,
        fontSize: "14px",
        color: "#cdb5ad",
        letterSpacing: 1,
      }).setOrigin(0.5);

      HOW_TO_PLAY.forEach(([frame, title, copy, color], index) => {
        const y = 672 + index * 112;
        const badge = this.add.circle(128, y, 42, 0x1d0c18, 0.96).setStrokeStyle(2, COLORS.gold, 0.6);
        const icon = this.add.image(128, y, "phoenix-symbols-v2", frame).setDisplaySize(72, 72);
        this.add.text(192, y - 22, title, {
          fontFamily: BODY_FONT,
          fontSize: "19px",
          fontStyle: "700",
          color,
          letterSpacing: 2,
        });
        this.add.text(192, y + 8, copy, {
          fontFamily: BODY_FONT,
          fontSize: "17px",
          color: "#c7b5bb",
        });
        this.tweens.add({ targets: icon, scale: { from: icon.scale, to: icon.scale * 1.08 }, duration: 1100 + index * 140, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        this.tweens.add({ targets: badge, alpha: { from: 0.75, to: 1 }, duration: 1100 + index * 140, yoyo: true, repeat: -1 });
      });

      makeButton(this, WIDTH / 2, 1210, 540, 96, "ENTER THE PHOENIX REALM", () => {
        window.GamishAudio?.play("flame-burst");
        setStatus("Opening the Phoenix Realm.");
        this.cameras.main.flash(240, 255, 118, 32, false);
        this.cameras.main.fadeOut(420, 20, 7, 13);
        this.time.delayedCall(420, () => this.scene.start("GameZone"));
      }, { fill: 0x8d1f12, stroke: 0xffd87e, accent: 0xff5b12, fontSize: "21px" });

      this.add.text(WIDTH / 2, 1300, "VIRTUAL CREDITS  •  NO CASH VALUE", {
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
      const blocker = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x060309, 0.84).setInteractive();
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

  const PHOENIX_THEMES = [
    { name: "EMBER", accent: 0xff7a1a, particles: [0xff5b16, 0xffc457, 0xe0323d] },
    { name: "CRIMSON", accent: 0xff3b55, particles: [0xff3b55, 0xff8a6b, 0xb81d3a] },
    { name: "SOLAR", accent: 0xffc23e, particles: [0xffd76a, 0xffae2e, 0xfff1b0] },
    { name: "ROYAL", accent: 0xb77bff, particles: [0xb77bff, 0xffc96b, 0xe38bff] },
    { name: "ASCENDANT", accent: 0x4de7e1, particles: [0x4de7e1, 0xfff3d0, 0xffc96b] },
  ];

  // Reel window geometry, measured from the transparent cells of phoenix-reel-frame-v3.
  const REEL = {
    frameY: 560,
    frameScaleX: 0.475,
    frameScaleY: 0.53,
    xs: [157, 384, 612],
    widths: [210, 204, 210],
    top: 373,
    bottom: 716,
    centerY: 545,
    pitch: 150,
    size: 142,
    minSpinMs: 850,
    stopGapMs: 300,
    quickGapMs: 80,
    speed: 2.6,
  };
  const AUTO_SPINS = 10;
  const COLLECTION_GOAL = 10;

  const buzz = (pattern) => {
    try { navigator.vibrate?.(pattern); } catch { /* Haptics are optional. */ }
  };

  const addPill = (scene, x, y, width, height, options = {}) => addOrnatePanel(scene, x, y, width, height, {
    fill: options.fill ?? 0x120913,
    fillAlpha: options.fillAlpha ?? 0.94,
    stroke: options.stroke ?? COLORS.gold,
    strokeAlpha: options.strokeAlpha ?? 0.5,
    lineWidth: options.lineWidth ?? 2,
    bend: options.bend ?? Math.min(26, height * 0.3),
    anchors: options.anchors ?? false,
  });

  class PhoenixGameScene extends Phaser.Scene {
    constructor() {
      super("PhoenixGame");
      this.bet = PHOENIX_BETS[0];
    }

    create() {
      this.credits = Number(window.GamishAccount?.player?.totalCredits || 0);
      this.lastWin = 0;
      this.phase = "idle";
      this.quickStop = false;
      this.pendingRound = null;
      this.stopEvents = [];
      this.autoLeft = 0;
      this.overlay = null;
      this.collection = this.loadCollection();
      this.theme = PHOENIX_THEMES[Math.min(this.collection.theme, PHOENIX_THEMES.length - 1)];
      setStatus("Phoenix Ruby. Swipe down on the reels or tap Spin. Match three on the center line to win.");

      fitBackground(this, "phoenix-gameplay-v3");
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x07030a, 0.42);
      addEdgeShade(this, 0.6, 0.85);
      addAtmosphere(this, 22, this.theme.particles);
      addTopBar(this, { title: "PHOENIX RUBY", back: () => this.returnToHall() });

      this.createHud();
      this.createMachine();
      this.createCollection();
      this.createControls();
      this.createPaytable();

      this.add.text(WIDTH / 2, 1478, "VIRTUAL CREDITS  •  NO CASH VALUE", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c4a486", letterSpacing: 3,
      }).setOrigin(0.5);

      this.refreshCollection(false);
      this.refreshHud();

      this.input.keyboard?.on("keydown-SPACE", () => this.spin());
      this.input.keyboard?.on("keydown-ENTER", () => this.spin());
      this.input.keyboard?.on("keydown-LEFT", () => this.stepBet(-1));
      this.input.keyboard?.on("keydown-DOWN", () => this.stepBet(-1));
      this.input.keyboard?.on("keydown-RIGHT", () => this.stepBet(1));
      this.input.keyboard?.on("keydown-UP", () => this.stepBet(1));
      this.input.keyboard?.on("keydown-ESC", () => (this.overlay ? this.overlay.close() : this.returnToHall()));

      this.walletListener = (event) => {
        if (this.phase !== "idle") return;
        this.credits = Number(event.detail?.totalCredits || 0);
        this.refreshHud();
      };
      window.addEventListener("gamish:wallet", this.walletListener);
      this.events.once("shutdown", () => {
        window.removeEventListener("gamish:wallet", this.walletListener);
        this.autoLeft = 0;
      });
      this.cameras.main.fadeIn(450, 8, 4, 10);
    }

    // ---------- Layout ----------

    createHud() {
      addPill(this, WIDTH / 2, 200, 704, 104, { fillAlpha: 0.9, strokeAlpha: 0.55, bend: 30, anchors: true });
      this.add.rectangle(WIDTH / 2, 200, 2, 60, COLORS.gold, 0.28);

      const balance = this.add.container(0, 0);
      const balanceLabel = this.add.text(70, 170, "BALANCE  ↻", {
        fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      });
      this.creditText = this.add.text(70, 190, "0", {
        fontFamily: DISPLAY_FONT, fontSize: "36px", color: "#fff0c0", stroke: "#4e1a0b", strokeThickness: 4,
      });
      balance.add([balanceLabel, this.creditText]);
      const balanceZone = this.add.zone(206, 200, 330, 100).setInteractive({ useHandCursor: true });
      balanceZone.on("pointerup", () => this.refreshAccountWallet());

      this.add.text(698, 170, "LAST WIN", {
        fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      }).setOrigin(1, 0);
      this.winText = this.add.text(698, 190, "0", {
        fontFamily: DISPLAY_FONT, fontSize: "36px", color: "#ffd66e", stroke: "#4e1a0b", strokeThickness: 4,
      }).setOrigin(1, 0);
    }

    createMachine() {
      this.aura = this.add.ellipse(WIDTH / 2, REEL.centerY, 820, 560, this.theme.accent, 0.16)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: this.aura, alpha: { from: 0.1, to: 0.24 }, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

      const backing = this.add.graphics();
      REEL.xs.forEach((x, column) => {
        const width = REEL.widths[column];
        backing.fillGradientStyle(0x2d1027, 0x2d1027, 0x0b060e, 0x0b060e, 0.96, 0.96, 0.98, 0.98);
        backing.fillRect(x - width / 2, REEL.top, width, REEL.bottom - REEL.top);
      });
      backing.fillStyle(0xffffff, 0.035);
      backing.fillRect(REEL.xs[0] - REEL.widths[0] / 2, REEL.centerY - REEL.pitch / 2, REEL.xs[2] - REEL.xs[0] + REEL.widths[0], REEL.pitch);

      const maskShape = this.make.graphics({ add: false });
      maskShape.fillStyle(0xffffff, 1);
      REEL.xs.forEach((x, column) => maskShape.fillRect(x - REEL.widths[column] / 2, REEL.top, REEL.widths[column], REEL.bottom - REEL.top));
      const reelLayer = this.add.container(0, 0);
      reelLayer.setMask(maskShape.createGeometryMask());

      this.reels = REEL.xs.map((x, column) => {
        const images = [-2, -1, 0, 1, 2].map((slot) => {
          const symbol = PHOENIX_SYMBOLS[(slot + 2 + column * 2) % PHOENIX_SYMBOLS.length];
          const image = this.add.image(x, REEL.centerY + slot * REEL.pitch, "phoenix-symbols-v2", symbol.frame)
            .setDisplaySize(REEL.size, REEL.size);
          reelLayer.add(image);
          return image;
        });
        return { x, column, images, rows: images.slice(1, 4), state: "idle", speed: 0 };
      });

      // Shadow at the top and bottom of each reel window gives the strips depth.
      const shade = this.add.graphics();
      shade.fillGradientStyle(0x07030a, 0x07030a, 0x07030a, 0x07030a, 0.85, 0.85, 0, 0);
      shade.fillRect(80, REEL.top, 610, 70);
      shade.fillGradientStyle(0x07030a, 0x07030a, 0x07030a, 0x07030a, 0, 0, 0.85, 0.85);
      shade.fillRect(80, REEL.bottom - 70, 610, 70);

      this.winLine = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.drawWinLine(this.theme.accent);

      this.add.image(WIDTH / 2, REEL.frameY, "phoenix-reel-frame-v3").setScale(REEL.frameScaleX, REEL.frameScaleY);

      this.resultText = this.add.text(WIDTH / 2, 852, "", {
        fontFamily: BODY_FONT, fontSize: "17px", fontStyle: "700", color: "#ffe2a6", letterSpacing: 3,
        stroke: "#140710", strokeThickness: 4,
      }).setOrigin(0.5);
      this.setMessage("SWIPE DOWN TO SPIN", "#ffe2a6");

      const zone = this.add.zone(WIDTH / 2, REEL.centerY, 660, REEL.bottom - REEL.top).setInteractive();
      zone.on("pointerdown", (pointer) => { this.swipeStart = { y: pointer.y, time: this.time.now }; });
      zone.on("pointerup", (pointer) => {
        const start = this.swipeStart;
        this.swipeStart = null;
        if (this.phase === "spinning") {
          this.requestQuickStop();
          return;
        }
        if (start && pointer.y - start.y > 40 && this.time.now - start.time < 700) this.spin();
      });
    }

    createCollection() {
      this.collectionPanel = addPill(this, WIDTH / 2, 936, 690, 108, { fillAlpha: 0.9, strokeAlpha: 0.45, bend: 28 });
      this.collectionIcon = this.add.image(96, 936, "phoenix-symbols-v2", "symbol-8").setDisplaySize(82, 82);
      this.tweens.add({ targets: this.collectionIcon, y: 930, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.add.text(150, 896, "EMBER COLLECTION", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#e8b872", letterSpacing: 3,
      });
      this.collectionText = this.add.text(704, 896, "0 / 10", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#e8c792", letterSpacing: 2,
      }).setOrigin(1, 0);
      this.gems = Array.from({ length: COLLECTION_GOAL }, (_, index) => {
        const x = 170 + index * 54;
        const socket = this.add.circle(x, 951, 19, 0x2a1426, 0.95).setStrokeStyle(2, 0x6b3a4c, 0.8);
        const gem = this.add.image(x, 951, "phoenix-symbols-v2", "symbol-1").setDisplaySize(40, 40).setAlpha(0);
        return { x, y: 951, socket, gem };
      });
    }

    createControls() {
      // Bet stepper
      addPill(this, 138, 1150, 222, 104, { fillAlpha: 0.92, strokeAlpha: 0.5 });
      this.add.text(138, 1114, "BET", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c9a987", letterSpacing: 4,
      }).setOrigin(0.5);
      this.betText = this.add.text(138, 1160, "10", {
        fontFamily: DISPLAY_FONT, fontSize: "32px", color: "#fff0c0",
      }).setOrigin(0.5);
      this.betDown = this.makeRoundButton(62, 1160, 30, "−", () => this.stepBet(-1));
      this.betUp = this.makeRoundButton(214, 1160, 30, "+", () => this.stepBet(1));

      // Auto spin
      this.autoPanel = addPill(this, 630, 1150, 222, 104, { fillAlpha: 0.92, strokeAlpha: 0.5 });
      this.autoTitle = this.add.text(630, 1132, "AUTO", {
        fontFamily: DISPLAY_FONT, fontSize: "24px", color: "#fff0c0",
      }).setOrigin(0.5);
      this.autoSub = this.add.text(630, 1170, `${AUTO_SPINS} SPINS`, {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      }).setOrigin(0.5);
      const autoZone = this.add.zone(630, 1150, 222, 104).setInteractive({ useHandCursor: true });
      autoZone.on("pointerdown", () => this.tweens.add({ targets: [this.autoTitle, this.autoSub], scale: 0.92, duration: 70, yoyo: true }));
      autoZone.on("pointerup", () => this.toggleAuto());

      // Spin
      const spin = this.add.container(WIDTH / 2, 1150);
      this.spinHalo = this.add.circle(0, 0, 124, this.theme.accent, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      this.spinRing = this.add.graphics();
      this.spinRing.lineStyle(5, COLORS.gold, 0.9);
      for (let index = 0; index < 12; index += 1) {
        const start = Phaser.Math.DegToRad(index * 30);
        this.spinRing.beginPath();
        this.spinRing.arc(0, 0, 110, start, start + Phaser.Math.DegToRad(18));
        this.spinRing.strokePath();
      }
      const disc = this.add.circle(0, 0, 98, 0x9b2014, 1).setStrokeStyle(4, 0xffd87e, 1);
      const inner = this.add.circle(0, -6, 84, 0xc2331b, 0.55);
      const shine = this.add.ellipse(0, -52, 110, 26, 0xffffff, 0.16);
      this.spinLabel = this.add.text(0, -8, "SPIN", {
        fontFamily: DISPLAY_FONT, fontSize: "36px", color: "#fff4d2", stroke: "#5e1206", strokeThickness: 6,
      }).setOrigin(0.5);
      this.spinSub = this.add.text(0, 34, "10 CR", {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#ffd9a0", letterSpacing: 3,
      }).setOrigin(0.5);
      spin.add([this.spinHalo, this.spinRing, disc, inner, shine, this.spinLabel, this.spinSub]);
      spin.setSize(236, 236).setInteractive({ useHandCursor: true });
      spin.on("pointerdown", () => this.tweens.add({ targets: spin, scale: 0.93, duration: 80, yoyo: true }));
      spin.on("pointerup", () => this.spin());
      this.spinButton = spin;
      this.tweens.add({ targets: this.spinHalo, scale: { from: 0.94, to: 1.1 }, alpha: { from: 0.12, to: 0.32 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.ringTween = this.tweens.add({ targets: this.spinRing, angle: 360, duration: 9000, repeat: -1 });
    }

    createPaytable() {
      const entries = [
        { x: 214, frame: "symbol-1", label: "× 1.5", color: "#ff7d8c" },
        { x: 554, frame: "symbol-0", label: "× 3", color: "#ffd66e" },
      ];
      entries.forEach(({ x, frame, label, color }) => {
        const chip = this.add.container(x, 1318);
        const plate = addPill(this, 0, 0, 300, 84, { fillAlpha: 0.82, strokeAlpha: 0.32 });
        const icons = [-92, -54, -16].map((offset) => this.add.image(offset, 0, "phoenix-symbols-v2", frame).setDisplaySize(50, 50));
        const text = this.add.text(78, 0, label, {
          fontFamily: DISPLAY_FONT, fontSize: "28px", color, stroke: "#3b0d06", strokeThickness: 4,
        }).setOrigin(0.5);
        chip.add([plate, ...icons, text]);
        chip.setSize(300, 84).setInteractive({ useHandCursor: true });
        chip.on("pointerup", () => this.showRules());
      });
      const rules = this.add.container(WIDTH / 2, 1404);
      const rulesPlate = addPill(this, 0, 0, 250, 46, { fillAlpha: 0.9, strokeAlpha: 0.35, bend: 16 });
      const rulesText = this.add.text(0, 0, "ⓘ  RULES & PAYOUTS", {
        fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#f0cf95", letterSpacing: 2,
      }).setOrigin(0.5);
      rules.add([rulesPlate, rulesText]).setSize(250, 60).setInteractive({ useHandCursor: true });
      rules.on("pointerup", () => this.showRules());
    }

    makeRoundButton(x, y, radius, label, onClick) {
      const button = this.add.container(x, y);
      const disc = this.add.circle(0, 0, radius, 0x2a1020, 1).setStrokeStyle(2, COLORS.gold, 0.8);
      const text = this.add.text(0, -2, label, {
        fontFamily: BODY_FONT, fontSize: "30px", fontStyle: "700", color: "#ffe4a3",
      }).setOrigin(0.5);
      button.add([disc, text]);
      button.setSize(radius * 2 + 16, radius * 2 + 16).setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => this.tweens.add({ targets: button, scale: 0.88, duration: 70, yoyo: true }));
      button.on("pointerup", onClick);
      return button;
    }

    drawWinLine(color) {
      const left = REEL.xs[0] - REEL.widths[0] / 2 - 18;
      const right = REEL.xs[2] + REEL.widths[2] / 2 + 18;
      this.winLine.clear();
      this.winLine.fillStyle(color, 0.07);
      this.winLine.fillRect(left, REEL.centerY - REEL.pitch / 2, right - left, REEL.pitch);
      this.winLine.lineStyle(14, color, 0.35);
      this.winLine.lineBetween(left, REEL.centerY, right, REEL.centerY);
      this.winLine.lineStyle(4, 0xfff0b8, 0.95);
      this.winLine.lineBetween(left, REEL.centerY, right, REEL.centerY);
    }

    setMessage(text, color = "#ffe2a6") {
      this.resultText.setText(text).setColor(color);
      this.tweens.killTweensOf(this.resultText);
      this.resultText.setAlpha(1);
      this.tweens.add({ targets: this.resultText, scale: { from: 1.12, to: 1 }, duration: 220, ease: "Back.Out" });
    }

    // ---------- Reels ----------

    update(_time, delta) {
      const step = Math.min(delta, 50);
      this.reels?.forEach((reel) => {
        if (reel.state !== "spinning") return;
        const wrapAt = REEL.centerY + REEL.pitch * 2.5;
        reel.images.forEach((image) => {
          image.y += reel.speed * step;
          if (image.y > wrapAt) {
            image.y -= REEL.pitch * 5;
            image.setFrame(this.randomSymbol().frame);
          }
        });
      });
    }

    randomSymbol() {
      return PHOENIX_SYMBOLS[Math.floor(secureRandom() * PHOENIX_SYMBOLS.length)];
    }

    symbolForMark(mark) {
      return PHOENIX_SYMBOLS.find((symbol) => symbol.mark === mark) || PHOENIX_SYMBOLS[1];
    }

    startReels() {
      this.reels.forEach((reel, column) => {
        this.tweens.killTweensOf(reel.images);
        reel.images.forEach((image, slot) => image.setY(REEL.centerY + (slot - 2) * REEL.pitch).setDisplaySize(REEL.size, REEL.size));
        // A short upward wind-up, then the strip drops into a blur.
        this.tweens.add({
          targets: reel.images,
          y: `-=${22}`,
          duration: 110,
          delay: column * 70,
          ease: "Sine.Out",
          onComplete: () => {
            reel.state = "spinning";
            reel.speed = REEL.speed * 0.45;
            reel.images.forEach((image) => image.setDisplaySize(REEL.size * 0.9, REEL.size * 1.22).setAlpha(0.88));
            this.tweens.add({ targets: reel, speed: REEL.speed, duration: 220 });
          },
        });
      });
      this.rollTimer = this.time.addEvent({
        delay: 170,
        loop: true,
        callback: () => {
          if (this.reels.some((reel) => reel.state === "spinning")) window.GamishAudio?.play("reel-roll");
        },
      });
    }

    scheduleStops(marks) {
      this.stopEvents.forEach((event) => event.remove(false));
      this.stopEvents = [];
      const gap = this.quickStop ? REEL.quickGapMs : REEL.stopGapMs;
      let order = 0;
      this.reels.forEach((reel) => {
        if (reel.state === "stopped") return;
        this.stopEvents.push(this.time.delayedCall(order * gap, () => this.stopReel(reel, marks)));
        order += 1;
      });
    }

    stopReel(reel, marks) {
      if (reel.state === "stopped") return;
      if (reel.state !== "spinning") {
        // Still winding up: wait for the strip to start moving.
        this.stopEvents.push(this.time.delayedCall(60, () => this.stopReel(reel, marks)));
        return;
      }
      reel.state = "stopped";
      reel.speed = 0;
      const { column } = reel;
      const finals = [marks[column], marks[column + 3], marks[column + 6]].map((mark) => this.symbolForMark(mark));
      const frames = [this.randomSymbol(), ...finals, this.randomSymbol()];
      reel.images.sort((a, b) => a.y - b.y);
      reel.images.forEach((image, index) => {
        const slot = index - 2;
        image.setFrame(frames[index].frame).setDisplaySize(REEL.size, REEL.size).setAlpha(1);
        image.setY(REEL.centerY + slot * REEL.pitch - REEL.pitch * 0.7);
        this.tweens.add({
          targets: image,
          y: REEL.centerY + slot * REEL.pitch,
          duration: 340,
          ease: "Back.Out",
          easeParams: [1.8],
        });
      });
      reel.rows = reel.images.slice(1, 4);
      window.GamishAudio?.play("reel-stop");
      buzz(12);
      this.cameras.main.shake(70, 0.0018);
      if (this.reels.every((item) => item.state === "stopped")) {
        this.rollTimer?.remove(false);
        this.time.delayedCall(360, () => this.finishSpin());
      }
    }

    requestQuickStop() {
      if (this.phase !== "spinning" || this.quickStop) return;
      this.quickStop = true;
      if (this.pendingRound) this.scheduleStops(this.pendingRound.marks);
    }

    // ---------- Round flow ----------

    async spin() {
      if (this.overlay) return;
      if (this.phase === "spinning") {
        this.requestQuickStop();
        return;
      }
      if (this.phase !== "idle") return;
      if (this.credits < this.bet) {
        this.autoLeft = 0;
        this.refreshAuto();
        this.setMessage("NOT ENOUGH CREDITS", "#ff8277");
        setStatus("Not enough virtual credits. Open the wallet or lower your bet.");
        this.cameras.main.shake(170, 0.005);
        buzz([30, 40, 30]);
        window.GamishAudio?.play("lose");
        return;
      }

      this.phase = "spinning";
      this.quickStop = false;
      this.pendingRound = null;
      if (this.autoLeft > 0) this.autoLeft -= 1;
      this.refreshAuto();
      this.credits = Math.max(0, this.credits - this.bet);
      this.clearWin();
      this.setMessage(this.autoLeft > 0 ? "AUTO SPIN" : "TAP REELS TO STOP", "#ffd48b");
      this.spinLabel.setText("STOP");
      this.ringTween.timeScale = 8;
      this.tweens.add({ targets: this.aura, scale: 1.08, duration: 300, yoyo: true });
      this.refreshHud();
      window.GamishAudio?.play("reel-start");
      buzz(8);
      this.startReels();

      const startedAt = this.time.now;
      let round;
      try {
        const response = await window.GamishAccount.request("/api/game/spin", {
          method: "POST",
          body: JSON.stringify({ bet: this.bet }),
        });
        round = response.round;
      } catch (error) {
        if (!this.sys.isActive()) return;
        this.credits += this.bet;
        this.autoLeft = 0;
        this.failedSpin = error.message;
        this.pendingRound = { marks: this.currentMarks() };
        this.scheduleStops(this.pendingRound.marks);
        return;
      }
      if (!this.sys.isActive()) return;
      this.pendingRound = round;
      const wait = this.quickStop ? 0 : Math.max(0, REEL.minSpinMs - (this.time.now - startedAt));
      this.stopEvents.push(this.time.delayedCall(wait, () => this.scheduleStops(round.marks)));
    }

    currentMarks() {
      return Array.from({ length: 9 }, () => this.randomSymbol().mark);
    }

    finishSpin() {
      const round = this.pendingRound;
      this.pendingRound = null;
      this.spinLabel.setText("SPIN");
      this.ringTween.timeScale = 1;

      if (this.failedSpin) {
        const message = this.failedSpin;
        this.failedSpin = null;
        this.refreshAuto();
        this.refreshHud();
        this.setMessage("SPIN FAILED — TRY AGAIN", "#ff8277");
        setStatus(`Phoenix Ruby could not complete the spin: ${message}`);
        this.phase = "idle";
        return;
      }

      const payout = Number(round.payout);
      const multiplier = Number(round.multiplier);
      this.lastWin = payout;
      const serverCredits = Number(round.wallet.totalCredits);
      if (window.GamishAccount?.player) {
        Object.assign(window.GamishAccount.player, round.wallet);
        window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: window.GamishAccount.player }));
      }
      this.flyPhoenixGems(round.marks);

      if (payout > 0) {
        this.celebrateWin(payout, multiplier, serverCredits);
        return;
      }
      this.credits = serverCredits;
      this.refreshHud();
      const phoenixCount = round.marks.filter((mark) => mark === "R").length;
      if (phoenixCount === 0) {
        window.GamishAudio?.play("lose");
        this.setMessage("SO CLOSE — SPIN AGAIN", "#d7bfc4");
      }
      setStatus("Phoenix Ruby spin complete. No center-line win this time.");
      this.time.delayedCall(260, () => this.endRound());
    }

    endRound() {
      this.phase = "idle";
      if (this.autoLeft > 0 && !this.overlay) {
        this.time.delayedCall(420, () => {
          if (this.phase === "idle" && this.autoLeft > 0) this.spin();
        });
      } else {
        this.autoLeft = 0;
        this.refreshAuto();
      }
    }

    clearWin() {
      this.tweens.killTweensOf(this.winLine);
      this.winLine.setAlpha(0);
      this.reels.forEach((reel) => reel.rows.forEach((image) => {
        this.tweens.killTweensOf(image);
        image.setDisplaySize(REEL.size, REEL.size).setAngle(0);
      }));
    }

    celebrateWin(payout, multiplier, serverCredits) {
      const big = multiplier >= 3;
      const centers = this.reels.map((reel) => reel.rows[1]);
      const baseScale = centers[0].scaleX;
      this.winLine.setAlpha(1);
      this.tweens.add({ targets: this.winLine, alpha: { from: 1, to: 0.45 }, duration: 420, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: centers, scale: baseScale * 1.14, duration: 240, yoyo: true, repeat: 3, ease: "Sine.InOut" });
      this.cameras.main.flash(220, 255, 140, 40, false);
      window.GamishAudio?.play(big ? "win-big" : "win-small");
      this.time.delayedCall(140, () => window.GamishAudio?.play("coin-shower"));
      buzz(big ? [40, 60, 40, 60, 90] : [30, 50, 30]);

      const label = big ? "GOLDEN SEVENS" : "RUBY MATCH";
      this.setMessage(`${label}  +${payout.toLocaleString("en-US")}`, "#ffe080");
      setStatus(`${label}. ${payout} virtual credits won at ${multiplier} times the bet.`);
      this.countTo(this.winText, 0, payout, 700);
      this.coinBurst(big ? 18 : 10, () => {
        const from = this.credits;
        this.credits = serverCredits;
        this.countTo(this.creditText, from, serverCredits, 500);
      });

      if (big) {
        this.autoLeft = 0;
        this.refreshAuto();
        this.time.delayedCall(650, () => this.showBigWin(payout, multiplier));
      } else {
        this.time.delayedCall(900, () => this.endRound());
      }
    }

    countTo(text, from, to, duration) {
      const counter = { value: from };
      this.tweens.add({
        targets: counter,
        value: to,
        duration,
        ease: "Cubic.Out",
        onUpdate: () => text.setText(Math.round(counter.value).toLocaleString("en-US")),
        onComplete: () => text.setText(to.toLocaleString("en-US")),
      });
      this.tweens.add({ targets: text, scale: { from: 1.18, to: 1 }, duration: 420, ease: "Back.Out" });
    }

    coinBurst(count, onArrive) {
      let arrived = 0;
      for (let index = 0; index < count; index += 1) {
        const coin = this.add.image(WIDTH / 2 + Phaser.Math.Between(-160, 160), REEL.centerY + Phaser.Math.Between(-30, 30), "phoenix-symbols-v2", "symbol-7")
          .setDisplaySize(48, 48).setDepth(60);
        this.tweens.add({
          targets: coin,
          y: coin.y - Phaser.Math.Between(60, 160),
          duration: 260,
          delay: index * 35,
          ease: "Quad.Out",
          onComplete: () => this.tweens.add({
            targets: coin,
            x: 130,
            y: 212,
            scale: coin.scale * 0.45,
            angle: Phaser.Math.Between(180, 540),
            duration: 460,
            ease: "Cubic.In",
            onComplete: () => {
              coin.destroy();
              arrived += 1;
              if (arrived % 3 === 1) window.GamishAudio?.play("tick");
              if (arrived === count) onArrive();
            },
          }),
        });
      }
    }

    showBigWin(payout, multiplier) {
      const overlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(120).setAlpha(0);
      const shade = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x050207, 0.86).setInteractive();
      const glow = this.add.circle(0, -80, 260, 0xff8c18, 0.2).setBlendMode(Phaser.BlendModes.ADD);
      const panel = addPill(this, 0, 120, 600, 340, { fill: 0x160911, fillAlpha: 0.97, strokeAlpha: 0.95, lineWidth: 4, bend: 48, anchors: true });
      const phoenix = this.add.image(0, -150, "phoenix-symbols-v2", "symbol-8").setDisplaySize(300, 300);
      const heading = this.add.text(0, 40, "BIG WIN", {
        fontFamily: DISPLAY_FONT, fontSize: "64px", color: "#fff0a8", stroke: "#8b1c08", strokeThickness: 10,
        shadow: { offsetY: 8, color: "#000000", blur: 18, fill: true },
      }).setOrigin(0.5);
      const amount = this.add.text(0, 130, "+0", {
        fontFamily: DISPLAY_FONT, fontSize: "58px", color: "#ffd461", stroke: "#6c1608", strokeThickness: 8,
      }).setOrigin(0.5);
      const caption = this.add.text(0, 196, `${multiplier}× YOUR BET  •  VIRTUAL CREDITS`, {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#f2c989", letterSpacing: 4,
      }).setOrigin(0.5);
      const hint = this.add.text(0, 250, "TAP TO COLLECT", {
        fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#fff0c8", letterSpacing: 5,
      }).setOrigin(0.5);
      overlay.add([shade, glow, panel, phoenix, heading, amount, caption, hint]);
      const counter = { value: 0 };
      this.tweens.add({ targets: counter, value: payout, duration: 1100, ease: "Cubic.Out", onUpdate: () => amount.setText(`+${Math.round(counter.value).toLocaleString("en-US")}`) });

      for (let index = 0; index < 22; index += 1) {
        const coin = this.add.image(Phaser.Math.Between(-340, 340), Phaser.Math.Between(-860, -480), "phoenix-symbols-v2", "symbol-7")
          .setDisplaySize(Phaser.Math.Between(40, 66), Phaser.Math.Between(40, 66)).setAngle(Phaser.Math.Between(-70, 70));
        overlay.add(coin);
        this.tweens.add({
          targets: coin,
          y: Phaser.Math.Between(430, 820),
          x: coin.x + Phaser.Math.Between(-90, 90),
          angle: coin.angle + Phaser.Math.Between(240, 720),
          duration: Phaser.Math.Between(1400, 2200),
          delay: Phaser.Math.Between(0, 500),
          ease: "Cubic.In",
        });
      }

      this.tweens.add({ targets: overlay, alpha: 1, scale: { from: 0.88, to: 1 }, duration: 300, ease: "Back.Out" });
      this.tweens.add({ targets: glow, scale: { from: 0.85, to: 1.25 }, alpha: { from: 0.14, to: 0.36 }, duration: 700, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: phoenix, y: -170, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: hint, alpha: { from: 1, to: 0.35 }, duration: 600, yoyo: true, repeat: -1 });
      window.GamishAudio?.play("flame-burst");

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        window.GamishAudio?.play("tap");
        this.tweens.add({
          targets: overlay, alpha: 0, scale: 1.05, duration: 240,
          onComplete: () => {
            overlay.destroy(true);
            this.overlay = null;
            this.endRound();
          },
        });
      };
      shade.on("pointerup", close);
      this.overlay = { close };
      this.time.delayedCall(4000, close);
    }

    // ---------- Collection ----------

    flyPhoenixGems(marks) {
      const found = [];
      marks.forEach((mark, index) => {
        if (mark === "R") found.push(this.reels[index % 3].rows[Math.floor(index / 3)]);
      });
      if (!found.length) return;
      window.GamishAudio?.play("collection");
      if (!this.lastWin) this.setMessage(`PHOENIX FOUND  +${found.length} GEM${found.length === 1 ? "" : "S"}`, "#ffba61");
      found.forEach((image, order) => {
        const target = this.gems[Math.min(this.collection.gems + order, COLLECTION_GOAL - 1)];
        const flyer = this.add.image(image.x, image.y, "phoenix-symbols-v2", "symbol-1").setDisplaySize(64, 64).setDepth(60);
        this.tweens.add({ targets: image, scale: image.scaleX * 1.2, duration: 160, yoyo: true, repeat: 1 });
        this.tweens.add({
          targets: flyer,
          x: target.x,
          y: target.y,
          scale: flyer.scaleX * 0.62,
          angle: 360,
          duration: 620,
          delay: 120 + order * 140,
          ease: "Cubic.InOut",
          onComplete: () => {
            flyer.destroy();
            if (order === found.length - 1) this.collectPhoenix(found.length);
          },
        });
      });
    }

    collectionStorageKey() {
      const playerId = window.GamishAccount?.player?.loginId || window.GamishAccount?.player?.id || "player";
      return `gamish777-phoenix-collection-${playerId}`;
    }

    loadCollection() {
      try {
        const stored = JSON.parse(window.localStorage.getItem(this.collectionStorageKey()) || "null");
        return {
          gems: Phaser.Math.Clamp(Number(stored?.gems) || 0, 0, COLLECTION_GOAL - 1),
          theme: Math.max(0, Number(stored?.theme) || 0),
        };
      } catch {
        return { gems: 0, theme: 0 };
      }
    }

    collectPhoenix(amount) {
      const total = this.collection.gems + amount;
      const levels = Math.floor(total / COLLECTION_GOAL);
      this.collection.gems = total % COLLECTION_GOAL;
      this.collection.theme += levels;
      try {
        window.localStorage.setItem(this.collectionStorageKey(), JSON.stringify(this.collection));
      } catch {
        // Collection still works for this session when storage is unavailable.
      }
      if (levels > 0) {
        this.gems.forEach((slot) => slot.gem.setAlpha(1));
        this.time.delayedCall(260, () => {
          this.refreshCollection(true);
          this.unlockTheme();
        });
      } else {
        this.refreshCollection(true);
      }
    }

    refreshCollection(animate = true) {
      this.collectionText.setText(`${this.collection.gems} / ${COLLECTION_GOAL}  •  ${this.theme.name}`);
      this.gems.forEach((slot, index) => {
        const filled = index < this.collection.gems;
        const wasFilled = slot.gem.alpha > 0.5;
        slot.gem.setAlpha(filled ? 1 : 0);
        slot.socket.setStrokeStyle(2, filled ? this.theme.accent : 0x6b3a4c, filled ? 1 : 0.8);
        if (animate && filled && !wasFilled) {
          this.tweens.add({ targets: slot.gem, scale: { from: slot.gem.scaleX * 1.8, to: slot.gem.scaleX }, duration: 380, ease: "Back.Out" });
        }
      });
      if (animate) this.tweens.add({ targets: this.collectionIcon, scale: { from: this.collectionIcon.scaleX * 1.2, to: this.collectionIcon.scaleX }, duration: 360, ease: "Back.Out" });
    }

    unlockTheme() {
      this.theme = PHOENIX_THEMES[Math.min(this.collection.theme, PHOENIX_THEMES.length - 1)];
      this.aura.setFillStyle(this.theme.accent, 0.16);
      this.spinHalo.setFillStyle(this.theme.accent, 0.18);
      this.drawWinLine(this.theme.accent);
      this.refreshCollection(false);
      window.GamishAudio?.play("theme-unlock");
      buzz([50, 40, 50]);
      const color = Phaser.Display.Color.IntegerToColor(this.theme.accent);
      this.cameras.main.flash(420, color.red, color.green, color.blue, false);
      const banner = this.add.text(WIDTH / 2, REEL.centerY, `${this.theme.name} THEME UNLOCKED`, {
        fontFamily: DISPLAY_FONT, fontSize: "34px", color: "#fff3c8", stroke: "#3b0d06", strokeThickness: 8,
      }).setOrigin(0.5).setDepth(80).setScale(0.6).setAlpha(0);
      this.tweens.add({
        targets: banner, alpha: 1, scale: 1, duration: 360, ease: "Back.Out", hold: 1300, yoyo: true,
        onComplete: () => banner.destroy(),
      });
      setStatus(`Collection complete. ${this.theme.name} theme unlocked.`);
    }

    // ---------- Controls ----------

    stepBet(direction) {
      if (this.phase !== "idle" || this.overlay) return;
      const index = PHOENIX_BETS.indexOf(this.bet);
      const next = PHOENIX_BETS[Phaser.Math.Clamp(index + direction, 0, PHOENIX_BETS.length - 1)];
      if (next === this.bet) {
        this.tweens.add({ targets: this.betText, x: this.betText.x + direction * 6, duration: 50, yoyo: true, repeat: 1 });
        return;
      }
      this.bet = next;
      window.GamishAudio?.play("chip");
      buzz(6);
      this.tweens.add({ targets: this.betText, scale: { from: 1.3, to: 1 }, duration: 260, ease: "Back.Out" });
      this.refreshHud();
      setStatus(`Bet set to ${next} virtual credits.`);
    }

    toggleAuto() {
      if (this.overlay) return;
      window.GamishAudio?.play("tap");
      if (this.autoLeft > 0) {
        this.autoLeft = 0;
        this.refreshAuto();
        setStatus("Auto spin stopped.");
        return;
      }
      this.autoLeft = AUTO_SPINS;
      this.refreshAuto();
      setStatus(`Auto spin on for ${AUTO_SPINS} spins.`);
      if (this.phase === "idle") this.spin();
    }

    refreshAuto() {
      const active = this.autoLeft > 0;
      this.autoTitle.setText(active ? "STOP" : "AUTO").setColor(active ? "#ffcf6e" : "#fff0c0");
      this.autoSub.setText(active ? `${this.autoLeft} LEFT` : `${AUTO_SPINS} SPINS`);
    }

    refreshHud() {
      this.creditText.setText(this.credits.toLocaleString("en-US"));
      this.winText.setText(this.lastWin.toLocaleString("en-US"));
      this.betText.setText(String(this.bet));
      this.spinSub.setText(`${this.bet} CR`);
      const index = PHOENIX_BETS.indexOf(this.bet);
      this.betDown.setAlpha(index > 0 ? 1 : 0.4);
      this.betUp.setAlpha(index < PHOENIX_BETS.length - 1 ? 1 : 0.4);
    }

    showRules() {
      if (this.overlay || this.phase !== "idle") return;
      window.GamishAudio?.play("tap");
      const sheet = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(120).setAlpha(0);
      const shade = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x050207, 0.78).setInteractive();
      const panel = addPill(this, 0, 0, 640, 640, { fill: 0x120913, fillAlpha: 0.98, strokeAlpha: 0.85, lineWidth: 3, bend: 44, anchors: true });
      const title = this.add.text(0, -262, "HOW TO WIN", {
        fontFamily: DISPLAY_FONT, fontSize: "32px", color: "#fff0bd", stroke: "#52150c", strokeThickness: 6,
      }).setOrigin(0.5);
      const rows = [
        ["symbol-0", "3 GOLDEN SEVENS", "Center line pays 3× your bet"],
        ["symbol-1", "3 RUBY DIAMONDS", "Center line pays 1.5× your bet"],
        ["symbol-8", "PHOENIX CREST", "Any Phoenix adds a collection gem.\n10 gems unlock a new realm theme."],
      ];
      const items = rows.flatMap(([frame, heading, copy], index) => {
        const y = -150 + index * 130;
        return [
          this.add.image(-230, y, "phoenix-symbols-v2", frame).setDisplaySize(96, 96),
          this.add.text(-160, y - 30, heading, { fontFamily: BODY_FONT, fontSize: "18px", fontStyle: "700", color: "#ffd98a", letterSpacing: 2 }),
          this.add.text(-160, y + 2, copy, { fontFamily: BODY_FONT, fontSize: "16px", color: "#cdb8bd", lineSpacing: 4 }),
        ];
      });
      const tip = this.add.text(0, 222, "Swipe down on the reels to spin.\nTap the reels to stop them early.", {
        fontFamily: BODY_FONT, fontSize: "15px", color: "#b79da4", align: "center", lineSpacing: 6,
      }).setOrigin(0.5);
      const hint = this.add.text(0, 282, "TAP ANYWHERE TO CLOSE", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#e0bb82", letterSpacing: 4,
      }).setOrigin(0.5);
      sheet.add([shade, panel, title, ...items, tip, hint]);
      this.tweens.add({ targets: sheet, alpha: 1, scale: { from: 0.94, to: 1 }, duration: 220, ease: "Back.Out" });
      const close = () => {
        this.tweens.add({
          targets: sheet, alpha: 0, duration: 160,
          onComplete: () => { sheet.destroy(true); this.overlay = null; },
        });
      };
      shade.on("pointerup", close);
      this.overlay = { close };
    }

    async refreshAccountWallet() {
      if (this.phase !== "idle") return;
      window.GamishAudio?.play("reset");
      try {
        const player = await window.GamishAccount.refreshWallet();
        this.credits = Number(player.totalCredits || 0);
        this.refreshHud();
        this.setMessage("WALLET REFRESHED", "#79efaf");
        setStatus(`Wallet refreshed. ${this.credits} virtual credits available.`);
      } catch (error) {
        this.setMessage("REFRESH FAILED", "#ff8176");
        setStatus(error.message);
      }
    }

    returnToHall() {
      if (this.phase !== "idle" || this.overlay) return;
      this.autoLeft = 0;
      this.cameras.main.fadeOut(300, 9, 4, 12);
      this.time.delayedCall(300, () => this.scene.start("GameZone"));
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
    Object.assign(VIEW, measureView());
    config.width = VIEW.width;
    config.height = VIEW.height;
    config.scale.width = VIEW.width;
    config.scale.height = VIEW.height;
    const game = new Phaser.Game(config);

    let resizeTimer;
    const refit = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = measureView();
        if (["width", "height", "left", "top"].every((key) => next[key] === VIEW[key])) return;
        Object.assign(VIEW, next);
        game.scale.setGameSize(VIEW.width, VIEW.height);
        game.scene.getScenes(true).forEach(applyView);
      }, 120);
    };
    window.addEventListener("resize", refit);
    window.visualViewport?.addEventListener("resize", refit);
  };

  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
})();
