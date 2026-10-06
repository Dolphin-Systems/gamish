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

  // Source coordinates for the supplied 7×5 game-art sheet (1484×1060). Phaser
  // frames expose each tile at its own dimensions without recompressing the original.
  const GAME_ART_CELLS = [
    ["Classic 777", 12, 14, 212, 195], ["Fruit Spin", 236, 14, 192, 195], ["Mega Reels", 438, 14, 194, 195],
    ["Jackpot Gold", 643, 14, 196, 195], ["Hold & Win", 849, 14, 196, 195], ["Crash", 1055, 14, 197, 195], ["Mines", 1262, 14, 210, 195],
    ["Plinko", 12, 218, 212, 194], ["Dice", 236, 218, 192, 194], ["Limbo", 438, 218, 194, 194],
    ["Blackjack", 643, 218, 196, 194], ["Video Poker", 849, 218, 196, 194], ["Baccarat", 1055, 218, 197, 194], ["Teen Patti", 1262, 218, 210, 194],
    ["Dragon Tiger", 12, 420, 212, 195], ["Roulette", 236, 420, 192, 195], ["Craps", 438, 420, 194, 195],
    ["Sic Bo", 643, 420, 196, 195], ["Lucky Wheel", 849, 420, 196, 195], ["Coin Flip", 1055, 420, 197, 195], ["Keno", 1262, 420, 210, 195],
    ["Bingo", 12, 622, 212, 194], ["Lucky Numbers", 236, 622, 192, 194], ["Pick 3", 438, 622, 194, 194],
    ["Number Rush", 643, 622, 196, 194], ["Fishing", 849, 622, 196, 194], ["Pachinko", 1055, 622, 197, 194], ["Target Shot", 1262, 622, 210, 194],
    ["Treasure Drop", 12, 822, 212, 203], ["Cannon Blast", 236, 822, 192, 203], ["Scratch Card", 438, 822, 194, 203],
    ["Hi-Lo", 643, 822, 196, 203], ["Mystery Box", 849, 822, 196, 203], ["Lucky Cups", 1055, 822, 197, 203], ["Treasure Chest", 1262, 822, 210, 203],
  ];
  const GAME_ART_BY_TITLE = new Map(GAME_ART_CELLS.map(([title], index) => [title, `game-art-${index}`]));

  const GAME_CATEGORIES = [
    { name: "All Games", icon: "✦", accent: 0xffc96b, games: [] },
    { name: "Slots", icon: "7", accent: 0xff7a1a, games: [
      ["Phoenix Ruby", "♦", true], ["Classic 777", "7"], ["Fruit Spin", "🍒"], ["Mega Reels", "✦"], ["Jackpot Gold", "♛"], ["Hold & Win", "❖"],
    ] },
    { name: "Instant", icon: "↗", accent: 0x4de7e1, games: [
      ["Crash", "↗"], ["Mines", "✹"], ["Plinko", "◉"], ["Dice", "⚄"], ["Limbo", "∞"],
    ] },
    { name: "Cards", icon: "♠", accent: 0xb783ff, games: [
      ["Blackjack", "♠"], ["Video Poker", "A♠"], ["Baccarat", "♥"], ["Teen Patti", "♣"], ["Dragon Tiger", "龍"],
    ] },
    { name: "Table Games", icon: "◉", accent: 0xffc14f, games: [
      ["Roulette", "◎"], ["Craps", "⚄"], ["Sic Bo", "⚂"], ["Lucky Wheel", "◉"], ["Coin Flip", "◒"],
    ] },
    { name: "Numbers", icon: "8", accent: 0xff6d79, games: [
      ["Keno", "▦"], ["Bingo", "B"], ["Lucky Numbers", "8"], ["Pick 3", "3"], ["Number Rush", "↗"],
    ] },
    { name: "Arcade", icon: "✥", accent: 0x68d39a, games: [
      ["Fishing", "♧"], ["Pachinko", "◉"], ["Target Shot", "◎"], ["Treasure Drop", "◆"], ["Cannon Blast", "✹"],
    ] },
    { name: "Quick Games", icon: "★", accent: 0xff9c47, games: [
      ["Scratch Card", "▤"], ["Hi-Lo", "↕"], ["Mystery Box", "▣"], ["Lucky Cups", "♧"], ["Treasure Chest", "♜"],
    ] },
  ].map((category) => ({
    ...category,
    games: category.games.map(([title, icon, playable = false]) => ({
      title, icon, playable, category: category.name, accent: category.accent, art: GAME_ART_BY_TITLE.get(title),
    })),
  }));
  GAME_CATEGORIES[0].games = GAME_CATEGORIES.slice(1).flatMap((category) => category.games);
  const PHOENIX_GAME = GAME_CATEGORIES.find((category) => category.name === "Slots").games[0];

  const PHOENIX_BETS = [10, 20, 40];
  const PHOENIX_SYMBOLS = [
    { mark: "7", frame: "symbol-0", name: "Golden Seven" },
    { mark: "◆", frame: "symbol-1", name: "Ruby Diamond" },
    { mark: "♛", frame: "symbol-2", name: "Ember Crown" },
    { mark: "✦", frame: "symbol-3", name: "Ember Star" },
    { mark: "R", frame: "symbol-8", name: "Phoenix" },
  ];

  const HOW_TO_PLAY = [
    ["symbol-0", "3 GOLDEN SEVENS", "Center line pays 3× your bet", "#ffd66e"],
    ["symbol-1", "3 RUBY DIAMONDS", "Center line pays 1.5× your bet", "#ff7d8c"],
    ["symbol-8", "PHOENIX CREST", "Collect gems to unlock realm themes", "#ffba61"],
  ];

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
    const span = WIDTH + BLEED * 2;
    scene.add.rectangle(WIDTH / 2, -BLEED / 2, span, BLEED, 0x07040b, top);
    addGradient(scene, -BLEED, 0, span, 240, [[0, `rgba(7,4,11,${top})`], [1, "rgba(7,4,11,0)"]], `fade-down:${top}`);
    addGradient(scene, -BLEED, HEIGHT - 300, span, 300, [[0, "rgba(7,4,11,0)"], [1, `rgba(7,4,11,${bottom})`]], `fade-up:${bottom}`);
    scene.add.rectangle(WIDTH / 2, HEIGHT + BLEED / 2, span, BLEED, 0x07040b, bottom);
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

  // Static vector art is drawn once into a shared texture and reused as a plain image. Phaser
  // re-tessellates Graphics paths every frame, which is the costliest thing a phone GPU/CPU
  // would otherwise do for these decorative panels.
  const bakeGraphics = (scene, key, width, height, draw) => {
    if (!scene.textures.exists(key)) {
      const graphics = scene.make.graphics({ add: false });
      draw(graphics);
      graphics.generateTexture(key, Math.ceil(width), Math.ceil(height));
      graphics.destroy();
    }
    return key;
  };

  // Vertical gradients (Graphics only supports them in WebGL, not when baking) as a 4px-wide strip.
  const gradientTexture = (scene, key, height, stops) => {
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 4, height);
      const context = texture.getContext();
      const gradient = context.createLinearGradient(0, 0, 0, height);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      context.fillStyle = gradient;
      context.fillRect(0, 0, 4, height);
      texture.refresh();
    }
    return key;
  };

  const addGradient = (scene, x, y, width, height, stops, key) => scene.add
    .image(x, y, gradientTexture(scene, key, Math.max(2, Math.round(height)), stops))
    .setOrigin(0)
    .setDisplaySize(width, height);

  const PANEL_PAD = 16;

  const drawOrnatePanel = (panel, x, y, width, height, options) => {
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
  };

  const addOrnatePanel = (scene, x, y, width, height, options = {}) => {
    const w = Math.round(width);
    const h = Math.round(height);
    const key = `panel:${w}x${h}:${[options.fill, options.fillAlpha, options.stroke, options.strokeAlpha, options.lineWidth, options.bend, options.anchors].join(",")}`;
    bakeGraphics(scene, key, w + PANEL_PAD * 2, h + PANEL_PAD * 2,
      (graphics) => drawOrnatePanel(graphics, PANEL_PAD + w / 2, PANEL_PAD + h / 2, w, h, options));
    return scene.add.image(x, y, key);
  };

  const addRule = (scene, y, width = 430) => {
    const key = `rule:${width}`;
    const cx = width / 2 + 4;
    const cy = 20;
    bakeGraphics(scene, key, width + 8, 40, (rule) => {
      rule.lineStyle(2, COLORS.gold, 0.52);
      rule.beginPath();
      rule.moveTo(cx - width / 2, cy + 5);
      traceCubic(rule,
        { x: cx - width / 2, y: cy + 5 }, { x: cx - width * 0.36, y: cy - 13 },
        { x: cx - width * 0.18, y: cy + 13 }, { x: cx - 24, y: cy });
      rule.strokePath();
      rule.beginPath();
      rule.moveTo(cx + 24, cy);
      traceCubic(rule,
        { x: cx + 24, y: cy }, { x: cx + width * 0.18, y: cy + 13 },
        { x: cx + width * 0.36, y: cy - 13 }, { x: cx + width / 2, y: cy + 5 });
      rule.strokePath();
      rule.fillStyle(COLORS.ember, 0.95);
      rule.fillPoints([
        new Phaser.Geom.Point(cx, cy - 8),
        new Phaser.Geom.Point(cx + 8, cy),
        new Phaser.Geom.Point(cx, cy + 8),
        new Phaser.Geom.Point(cx - 8, cy),
      ]);
    });
    return scene.add.image(WIDTH / 2, y, key);
  };

  // Destroying a container while its children still have running tweens leaves those tweens
  // updating dead objects (a Text whose canvas is gone throws inside the tween system and
  // freezes every animation), so stop them first.
  const destroyWithTweens = (scene, container, extraTweens = []) => {
    extraTweens.forEach((tween) => tween?.remove());
    scene.tweens.killTweensOf([container, ...container.list]);
    container.destroy(true);
  };

  // Press feedback that always settles back at full size, however fast the taps come.
  const pressFeedback = (scene, target, pressed = 0.93, rest = 1) => {
    scene.tweens.killTweensOf(target);
    target.setScale(pressed);
    scene.tweens.add({ targets: target, scale: rest, duration: 180, ease: "Back.Out" });
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
    container.on("pointerover", () => {
      scene.tweens.killTweensOf(container);
      scene.tweens.add({ targets: container, scale: 1.035, duration: 120 });
    });
    container.on("pointerout", () => {
      scene.tweens.killTweensOf(container);
      scene.tweens.add({ targets: container, scale: 1, duration: 140 });
    });
    container.on("pointerdown", () => {
      window.GamishAudio?.play("tap");
      pressFeedback(scene, container, 0.96);
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
      const outerGlow = scene.add.circle(0, 0, 42, COLORS.ember, 0.11).setBlendMode(Phaser.BlendModes.ADD);
      const disk = scene.add.circle(0, 0, 34, 0x0e0912, 0.96).setStrokeStyle(2, COLORS.gold, 0.82);
      const arrow = scene.add.text(-2, -2, "‹", { fontFamily: BODY_FONT, fontSize: "49px", color: "#ffe4a3" }).setOrigin(0.5);
      back.add([outerGlow, disk, arrow]).setSize(120, 120).setInteractive({ useHandCursor: true });
      back.on("pointerdown", () => {
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
      this.load.image("gamish-game-icons", "assets/gamish-game-icons.png");
    }

    create() {
      const gameArtTexture = this.textures.get("gamish-game-icons");
      GAME_ART_CELLS.forEach(([title, x, y, width, height]) => {
        const frame = GAME_ART_BY_TITLE.get(title);
        if (!gameArtTexture.has(frame)) gameArtTexture.add(frame, 0, x, y, width, height);
      });
      const symbolTexture = this.textures.get("phoenix-symbols-v2");
      const cell = 418;
      for (let index = 0; index < 9; index += 1) {
        const frameName = `symbol-${index}`;
        if (!symbolTexture.has(frameName)) {
          symbolTexture.add(frameName, 0, (index % 3) * cell, Math.floor(index / 3) * cell, cell, cell);
        }
      }
      document.getElementById("loading-fallback")?.classList.add("ready");
      this.scene.start("WaitForPlayer");
    }
  }

  class WaitForPlayerScene extends Phaser.Scene {
    constructor() {
      super("WaitForPlayer");
    }

    create() {
      const launch = () => {
        window.removeEventListener("gamish:authenticated", launch);
        this.scene.start("Landing");
      };
      if (window.GamishAccount?.player) launch();
      else window.addEventListener("gamish:authenticated", launch, { once: true });
      this.events.once("shutdown", () => window.removeEventListener("gamish:authenticated", launch));
    }
  }

  class LandingScene extends Phaser.Scene {
    constructor() {
      super("Landing");
    }

    create() {
      setStatus("Welcome to Gamish777. Your game lobby opens shortly.");
      const backdrop = fitBackground(this, "phoenix-realm-v2").setTint(0x8f7890);
      const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x100713, 0.48);
      addVignette(this, 0.26);
      const artKeys = ["phoenix", "dragon", "lion", "fox"];
      const slides = artKeys.map((key, index) => {
        const art = this.add.image(WIDTH / 2, HEIGHT / 2, key).setAlpha(0).setTint(0xffcf99);
        const source = art.texture.getSourceImage();
        const scale = Math.max(WIDTH / source.width, HEIGHT / source.height) * 1.08;
        art.setScale(scale);
        this.tweens.add({
          targets: art,
          alpha: { from: 0, to: 0.45 },
          scale: scale * 1.12,
          duration: 2500,
          delay: index * 2350,
          yoyo: true,
          hold: 900,
          ease: "Sine.InOut",
        });
        return art;
      });
      const aura = this.add.circle(WIDTH / 2, 585, 260, COLORS.ember, 0.08).setBlendMode(Phaser.BlendModes.ADD);
      const ring = this.add.circle(WIDTH / 2, 585, 202, 0x120812, 0.08).setStrokeStyle(2, COLORS.gold, 0.55);
      this.tweens.add({ targets: aura, scale: { from: 0.8, to: 1.25 }, alpha: { from: 0.06, to: 0.18 }, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: ring, angle: 360, duration: 18000, repeat: -1 });
      this.add.text(WIDTH / 2, 490, "GAMISH777", {
        fontFamily: DISPLAY_FONT, fontSize: "52px", color: "#fff0c0", stroke: "#621b0a", strokeThickness: 8,
        shadow: { offsetY: 7, color: "#000000", blur: 18, fill: true },
      }).setOrigin(0.5).setDepth(5);
      this.add.text(WIDTH / 2, 560, "A WORLD OF GAMES", {
        fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#ffe0a4", letterSpacing: 8,
      }).setOrigin(0.5).setDepth(5);
      addRule(this, 635, 470).setDepth(5);
      this.add.text(WIDTH / 2, 1090, "SPIN  ✦  PLAY  ✦  DISCOVER", {
        fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#fff0c0", letterSpacing: 5,
      }).setOrigin(0.5).setDepth(5);

      const skip = this.add.container(672, 100).setDepth(10);
      skip.add([
        this.add.circle(0, 0, 44, 0x170b16, 0.72).setStrokeStyle(2, COLORS.gold, 0.64),
        this.add.text(0, 0, "SKIP  ›", { fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#fff0c0", letterSpacing: 1 }).setOrigin(0.5),
      ]);
      skip.setSize(94, 94).setInteractive({ useHandCursor: true });
      skip.on("pointerup", () => this.openLoader());
      this.cameras.main.fadeIn(400, 7, 4, 11);
      this.time.delayedCall(11000, () => this.openLoader());
      this.events.once("shutdown", () => {
        slides.forEach((slide) => this.tweens.killTweensOf(slide));
        this.time.removeAllEvents();
      });
      this.openLoader = () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start("BrandLoader");
      };
      void backdrop;
      void shade;
    }
  }

  class BrandLoaderScene extends Phaser.Scene {
    constructor() {
      super("BrandLoader");
    }

    create() {
      setStatus("Gamish777. Lighting your game lobby.");
      fitBackground(this, "landing-bg").setTint(0x57424e);
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x08050b, 0.78);
      addVignette(this, 0.25);
      const crest = this.add.image(WIDTH / 2, 610, "phoenix-symbols-v2", "symbol-8").setDisplaySize(155, 155);
      const halo = this.add.circle(WIDTH / 2, 610, 100, COLORS.ember, 0.1).setBlendMode(Phaser.BlendModes.ADD);
      const orbit = this.add.circle(WIDTH / 2, 610, 115, 0x000000, 0).setStrokeStyle(3, COLORS.gold, 0.8);
      this.tweens.add({ targets: crest, y: 598, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: halo, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.08, to: 0.24 }, duration: 900, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: orbit, angle: 360, duration: 3600, repeat: -1 });
      this.add.text(WIDTH / 2, 790, "GAMISH777", {
        fontFamily: DISPLAY_FONT, fontSize: "43px", color: "#fff0c0", stroke: "#621b0a", strokeThickness: 7,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 850, "PREPARING YOUR LOBBY", {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#f4c98e", letterSpacing: 5,
      }).setOrigin(0.5);
      const track = addOrnatePanel(this, WIDTH / 2, 930, 420, 18, {
        fill: 0x4b2a38, fillAlpha: 0.65, stroke: COLORS.gold, strokeAlpha: 0.3, lineWidth: 1, bend: 7, anchors: false,
      });
      track.setAlpha(0.45);
      const bar = this.add.rectangle(WIDTH / 2 - 206, 930, 4, 8, COLORS.ember).setOrigin(0, 0.5);
      this.tweens.add({ targets: bar, width: 408, duration: 1050, ease: "Sine.InOut" });
      this.time.delayedCall(1200, () => this.scene.start("GameZone"));
    }
  }

  class GameZoneScene extends Phaser.Scene {
    constructor() {
      super("GameZone");
      this.modal = null;
    }

    create() {
      this.catalogCards = [];
      this.catalogScroll = 0;
      this.catalogDrag = null;
      this.hallContent = this.add.container(0, 0);
      const hallMask = this.make.graphics({ x: 0, y: 0, add: false });
      hallMask.fillStyle(0xffffff, 1).fillRect(0, 225, WIDTH, HEIGHT - 300);
      this.hallContent.setMask(hallMask.createGeometryMask());
      setStatus("Gamish777 game hall. Browse games or open your profile, chat, or payments.");
      this.cameras.main.setBackgroundColor("#0b0710");
      this.add.circle(140, 610, 300, 0x942c26, 0.06).setBlendMode(Phaser.BlendModes.ADD);
      this.add.circle(654, 1010, 370, 0x3b2069, 0.075).setBlendMode(Phaser.BlendModes.ADD);
      addAtmosphere(this, 18, [0xffad42, 0x6ee7ea, 0xd994ff]);

      this.add.text(350, 126, "GAMISH777", {
        fontFamily: DISPLAY_FONT,
        fontSize: "36px",
        color: "#fff1c6",
        shadow: { offsetY: 5, color: "#000000", blur: 16, fill: true },
      }).setOrigin(0.5);

      this.addMenuAction(548, "profile", "Player profile", () => this.openProfile());
      this.addMenuAction(626, "payments", "Payments", () => this.openAppView("payments"));
      this.addMenuAction(704, "chat", "Chat with support", () => this.openAppView("messages"));

      this.addFeaturedPhoenix(370);
      const allGamesHeading = this.add.text(48, 505, "ALL GAMES", {
        fontFamily: BODY_FONT,
        fontSize: "24px",
        fontStyle: "700",
        color: "#e6c17f",
        letterSpacing: 3,
      }).setOrigin(0, 0.5);
      const catalogCount = this.add.text(716, 505, `${GAME_CATEGORIES[0].games.length} GAMES`, {
        fontFamily: BODY_FONT, fontSize: "20px", fontStyle: "700", color: "#cdb6ad", letterSpacing: 1,
      }).setOrigin(1, 0.5);
      this.hallContent.add([allGamesHeading, catalogCount]);
      this.renderGameCards(GAME_CATEGORIES[0].games);

      this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
        if (pointer.y >= 225 && this.catalogMaxScroll > 0) this.setCatalogScroll(this.catalogScroll + deltaY * 1.1);
      });
      this.input.on("pointerdown", (pointer) => {
        if (pointer.y >= 225 && this.catalogMaxScroll > 0) this.catalogDrag = { y: pointer.y, scroll: this.catalogScroll, moved: false };
      });
      this.input.on("pointermove", (pointer) => {
        if (!this.catalogDrag || !pointer.isDown) return;
        const delta = this.catalogDrag.y - pointer.y;
        if (Math.abs(delta) > 8) {
          this.catalogDrag.moved = true;
          this.catalogDragMoved = true;
        }
        if (this.catalogDrag.moved) this.setCatalogScroll(this.catalogDrag.scroll + delta);
      });
      this.input.on("pointerup", () => {
        const moved = this.catalogDrag?.moved;
        this.catalogDrag = null;
        if (moved) this.time.delayedCall(80, () => { this.catalogDragMoved = false; });
      });

      this.input.keyboard?.on("keydown-ESC", () => {
        if (this.modal) this.closeModal(); else this.setCatalogScroll(0);
      });
      this.cameras.main.fadeIn(550, 9, 5, 12);
    }

    addMenuAction(x, kind, label, action) {
      const button = this.add.container(x, 126);
      const glow = this.add.circle(0, 0, 34, COLORS.ember, 0.08).setBlendMode(Phaser.BlendModes.ADD);
      const disk = this.add.circle(0, 0, 27, 0x1d101b, 0.94).setStrokeStyle(1.5, COLORS.gold, 0.64);
      const icon = this.add.graphics().lineStyle(2.3, COLORS.ivory, 0.96);
      if (kind === "profile") {
        icon.strokeCircle(0, -5, 5);
        icon.fillStyle(COLORS.ivory, 0.96).fillEllipse(0, 10, 21, 11);
      } else if (kind === "payments") {
        icon.strokeRoundedRect(-11, -8, 22, 17, 4);
        icon.strokeRoundedRect(3, -3, 11, 8, 3);
        icon.fillStyle(COLORS.ivory, 1).fillCircle(6, 1, 1.5);
      } else {
        icon.strokeRoundedRect(-11, -9, 22, 17, 5);
        icon.beginPath().moveTo(-5, 8).lineTo(-9, 12).lineTo(-8, 5).strokePath();
        [-4, 0, 4].forEach((dotX) => icon.fillStyle(COLORS.ivory, 0.95).fillCircle(dotX, 0, 1.25));
      }
      button.add([glow, disk, icon]).setSize(72, 72).setInteractive({ useHandCursor: true });
      button.setData("label", label);
      button.on("pointerup", () => {
        window.GamishAudio?.play("nav");
        setStatus(label);
        action();
      });
      button.on("pointerover", () => this.tweens.add({ targets: button, scale: 1.08, duration: 110 }));
      button.on("pointerout", () => this.tweens.add({ targets: button, scale: 1, duration: 120 }));
      return button;
    }

    openAppView(name) {
      window.dispatchEvent(new CustomEvent("gamish:navigate", { detail: name }));
    }

    openProfile() {
      if (this.modal) return;
      const player = window.GamishAccount?.player || {};
      const balance = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
        .format(Number(player.totalCredits || 0) / 100);
      const modal = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(100);
      const blocker = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x060309, 0.84).setInteractive();
      const panel = addSoftPanel(this, 0, 0, 570, 500, { fill: 0x130b18, alpha: 0.98, radius: 44 });
      const avatar = this.add.circle(0, -135, 44, 0x44202a, 0.96).setStrokeStyle(2, COLORS.gold, 0.75);
      const initial = this.add.text(0, -135, String(player.loginId || "P").charAt(0).toUpperCase(), {
        fontFamily: DISPLAY_FONT, fontSize: "36px", color: "#fff0c0",
      }).setOrigin(0.5);
      const heading = this.add.text(0, -62, "PLAYER PROFILE", {
        fontFamily: DISPLAY_FONT, fontSize: "25px", color: "#fff0c2",
      }).setOrigin(0.5);
      const idLabel = this.add.text(0, 6, "PLAYER ID", {
        fontFamily: BODY_FONT, fontSize: "15px", fontStyle: "700", color: "#c7a984", letterSpacing: 3,
      }).setOrigin(0.5);
      const id = this.add.text(0, 42, player.loginId || "—", {
        fontFamily: BODY_FONT, fontSize: "27px", fontStyle: "700", color: "#fff0c0",
      }).setOrigin(0.5);
      const walletLabel = this.add.text(0, 93, "AVAILABLE BALANCE", {
        fontFamily: BODY_FONT, fontSize: "15px", fontStyle: "700", color: "#c7a984", letterSpacing: 3,
      }).setOrigin(0.5);
      const wallet = this.add.text(0, 128, balance, {
        fontFamily: DISPLAY_FONT, fontSize: "30px", color: "#ffd381",
      }).setOrigin(0.5);
      modal.add([blocker, panel, avatar, initial, heading, idLabel, id, walletLabel, wallet]);
      const close = this.add.container(WIDTH / 2, HEIGHT / 2 + 190).setDepth(101);
      close.add([
        addSoftPanel(this, 0, 0, 330, 64, { fill: COLORS.ember, alpha: 0.2, radius: 28 }),
        this.add.text(0, 0, "BACK TO GAME HALL", { fontFamily: BODY_FONT, fontSize: "20px", fontStyle: "700", color: "#fff0c0", letterSpacing: 1 }).setOrigin(0.5),
      ]);
      close.setSize(350, 74).setInteractive({ useHandCursor: true });
      close.on("pointerup", () => this.closeModal());
      modal.setScale(0.92).setAlpha(0);
      this.tweens.add({ targets: modal, scale: 1, alpha: 1, duration: 220, ease: "Back.Out" });
      this.modal = { modal, close };
    }

    addFeaturedPhoenix(y) {
      const featured = this.add.container(WIDTH / 2, y);
      const glow = this.add.circle(0, 0, 350, COLORS.ember, 0.07).setBlendMode(Phaser.BlendModes.ADD);
      const plate = addSoftPanel(this, 0, 0, 696, 176, {
        fill: 0x1a0d1a, alpha: 0.92, radius: 38,
      });
      const art = this.add.image(-222, 0, "phoenix").setDisplaySize(236, 166).setTint(0xffd7a0);
      const title = this.add.text(-66, -18, "PHOENIX RUBY", {
        fontFamily: DISPLAY_FONT, fontSize: "24px", color: "#fff0c2",
        shadow: { offsetY: 3, color: "#000000", blur: 10, fill: true },
      });
      const play = this.add.text(258, 0, "PLAY  ›", {
        fontFamily: BODY_FONT, fontSize: "22px", fontStyle: "700", color: "#ffc96b", letterSpacing: 1,
      }).setOrigin(0.5);
      featured.add([glow, plate, art, title, play]).setSize(696, 184).setInteractive({ useHandCursor: true });
      featured.on("pointerup", () => {
        if (!this.catalogDragMoved) this.launchPhoenix();
      });
      featured.on("pointerover", () => this.tweens.add({ targets: featured, scale: 1.015, duration: 120 }));
      featured.on("pointerout", () => this.tweens.add({ targets: featured, scale: 1, duration: 120 }));
      this.hallContent.add(featured);
    }

    renderGameCards(games) {
      this.catalogCards.forEach((card) => card.container.destroy(true));
      this.catalogCards = [];
      const columns = [198, 570];
      const rowStep = 276;
      const cardHeight = 246;
      const firstY = 655;
      games.forEach((game, index) => {
        const position = { x: columns[index % 2], y: firstY + Math.floor(index / 2) * rowStep };
        const card = this.add.container(position.x, position.y);
        const halo = this.add.circle(0, 0, 132, game.accent, 0.055).setBlendMode(Phaser.BlendModes.ADD);
        let art;
        if (game.art) {
          art = this.add.image(0, -14, "gamish-game-icons", game.art).setDisplaySize(212, 212);
        } else {
          art = this.add.image(0, -14, "phoenix").setDisplaySize(212, 212);
        }
        card.add([halo, art]);
        if (game.playable) {
          const state = this.add.text(0, 108, "PHOENIX RUBY  ·  PLAY  ›", {
            fontFamily: BODY_FONT, fontSize: "17px", fontStyle: "700", color: "#ffc96b", letterSpacing: 0.6,
          }).setOrigin(0.5);
          card.add(state);
        }
        card.setSize(338, cardHeight + 8).setInteractive({ useHandCursor: true });
        card.on("pointerdown", () => {
          if (!this.catalogDragMoved) window.GamishAudio?.play("tap");
        });
        card.on("pointerup", () => {
          if (this.catalogDragMoved) return;
          if (game.playable) this.launchPhoenix();
          else this.openGameModal(game);
        });
        card.on("pointerover", () => {
          if (!this.catalogDrag) this.tweens.add({ targets: card, scale: 1.025, duration: 120 });
        });
        card.on("pointerout", () => this.tweens.add({ targets: card, scale: 1, duration: 120 }));
        this.hallContent.add(card);
        this.catalogCards.push({ container: card, x: position.x, y: position.y });
      });
      const rowCount = Math.ceil(games.length / 2);
      const contentBottom = firstY + Math.max(0, rowCount - 1) * rowStep + cardHeight / 2 + 4;
      this.catalogMaxScroll = Math.max(0, contentBottom - (HEIGHT - 110));
      this.catalogDragMoved = false;
    }

    setCatalogScroll(value) {
      this.catalogScroll = Phaser.Math.Clamp(value, 0, this.catalogMaxScroll || 0);
      this.hallContent.y = -this.catalogScroll;
    }

    launchPhoenix() {
      window.GamishAudio?.play("flame-burst");
      this.cameras.main.fadeOut(320, 12, 4, 10);
      this.time.delayedCall(320, () => this.scene.start("PhoenixGame"));
    }

    openGameModal(game) {
      if (this.modal) return;
      setStatus(`${game.title} game preview opened.`);
      const modal = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(100);
      const blocker = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x060309, 0.84).setInteractive();
      const glow = this.add.circle(0, -100, 160, game.accent, 0.14);
      const panel = addSoftPanel(this, 0, 0, 570, 610, {
        fill: 0x130b18, alpha: 0.98, radius: 44,
      });
      const iconPlate = this.add.circle(0, -120, 92, game.accent, 0.14);
      const icon = this.add.text(0, -120, game.icon, {
        fontFamily: BODY_FONT, fontSize: "82px", fontStyle: "700", color: "#fff0c0",
      }).setOrigin(0.5);
      const title = this.add.text(0, 18, game.title.toUpperCase(), {
        fontFamily: DISPLAY_FONT,
        fontSize: "26px",
        color: "#fff0c2",
        shadow: { offsetY: 4, color: "#000000", blur: 12, fill: true },
      }).setOrigin(0.5);
      const copy = this.add.text(0, 84, `${game.category.toUpperCase()}  •  GAME PREVIEW\nThis game is not playable yet.`, {
        fontFamily: BODY_FONT,
        fontSize: "21px",
        color: "#cbb8bf",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5);
      modal.add([blocker, glow, panel, iconPlate, icon, title, copy]);
      const closeLabel = "BACK TO GAME HALL";
      const close = this.add.container(WIDTH / 2, HEIGHT / 2 + 226).setDepth(101);
      close.add([
        addSoftPanel(this, 0, 0, 360, 70, { fill: game.accent, alpha: 0.2, radius: 30 }),
        this.add.text(0, 0, closeLabel, { fontFamily: BODY_FONT, fontSize: "24px", fontStyle: "700", color: "#fff0c0", letterSpacing: 1 }).setOrigin(0.5),
      ]);
      close.setSize(370, 78).setInteractive({ useHandCursor: true });
      close.on("pointerup", () => this.closeModal());
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
          destroyWithTweens(this, modal);
          destroyWithTweens(this, close);
          setStatus("Browsing all games on Gamish777.");
        },
      });
    }

    returnToLanding() {
      if (this.modal) this.closeModal();
      else this.setCatalogScroll(0);
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
  const SPIN_PRESS_GAP_MS = 140;
  const SPIN_TIMEOUT_MS = 15000;
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

  const addSoftPanel = (scene, x, y, width, height, options = {}) => {
    const fill = options.fill ?? 0x130b18;
    const alpha = options.alpha ?? 0.82;
    const radius = options.radius ?? 28;
    const accent = options.accent ?? null;
    const key = `soft-panel:${width}x${height}:${fill}:${alpha}:${radius}:${accent ?? "none"}`;
    bakeGraphics(scene, key, width + 8, height + 8, (graphics) => {
      if (accent !== null) {
        graphics.fillStyle(accent, 0.08);
        graphics.fillRoundedRect(2, 2, width + 4, height + 4, radius + 4);
      }
      graphics.fillStyle(fill, alpha);
      graphics.fillRoundedRect(4, 4, width, height, radius);
      if (accent !== null) {
        graphics.fillStyle(accent, 0.72);
        graphics.fillRoundedRect(4, 18, 5, Math.max(12, height - 36), 3);
      }
    });
    return scene.add.image(x, y, key);
  };

  class PhoenixGameScene extends Phaser.Scene {
    constructor() {
      super("PhoenixGame");
      this.bet = PHOENIX_BETS[0];
    }

    create() {
      this.credits = Number(window.GamishAccount?.player?.totalCredits || 0);
      this.lastWin = 0;
      this.phase = "idle";
      this.leaving = false;
      this.quickStop = false;
      this.pendingRound = null;
      this.stopEvents = [];
      this.autoLeft = 0;
      this.overlay = null;
      this.lastSpinPress = 0;
      this.collection = this.loadCollection();
      this.theme = PHOENIX_THEMES[Math.min(this.collection.theme, PHOENIX_THEMES.length - 1)];
      setStatus("Phoenix Ruby. Swipe down on the reels or tap Spin. Match three on the center line to win.");

      // Darken the art with a tint rather than a full-screen overlay: one less full-screen blend per frame.
      fitBackground(this, "phoenix-gameplay-v3").setTint(0x958f94);
      addEdgeShade(this, 0.6, 0.85);
      addAtmosphere(this, 16, this.theme.particles);
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

      const windowHeight = REEL.bottom - REEL.top;
      REEL.xs.forEach((x, column) => {
        const width = REEL.widths[column];
        addGradient(this, x - width / 2, REEL.top, width, windowHeight,
          [[0, "rgba(45,16,39,0.96)"], [1, "rgba(11,6,14,0.98)"]], "reel-backing");
      });
      const rowLeft = REEL.xs[0] - REEL.widths[0] / 2;
      const rowWidth = REEL.xs[2] - REEL.xs[0] + REEL.widths[0];
      this.add.rectangle(rowLeft + rowWidth / 2, REEL.centerY, rowWidth, REEL.pitch, 0xffffff, 0.035);

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
      addGradient(this, 80, REEL.top, 610, 70, [[0, "rgba(7,3,10,0.85)"], [1, "rgba(7,3,10,0)"]], "reel-shade-top");
      addGradient(this, 80, REEL.bottom - 70, 610, 70, [[0, "rgba(7,3,10,0)"], [1, "rgba(7,3,10,0.85)"]], "reel-shade-bottom");

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
      autoZone.on("pointerdown", () => {
        pressFeedback(this, this.autoTitle, 0.9);
        pressFeedback(this, this.autoSub, 0.9);
      });
      autoZone.on("pointerup", () => this.toggleAuto());

      // Spin
      const spin = this.add.container(WIDTH / 2, 1150);
      this.spinHalo = this.add.circle(0, 0, 124, this.theme.accent, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      const ringKey = bakeGraphics(this, "spin-ring", 232, 232, (ring) => {
        ring.lineStyle(5, COLORS.gold, 0.9);
        for (let index = 0; index < 12; index += 1) {
          const start = Phaser.Math.DegToRad(index * 30);
          ring.beginPath();
          ring.arc(116, 116, 110, start, start + Phaser.Math.DegToRad(18));
          ring.strokePath();
        }
      });
      this.spinRing = this.add.image(0, 0, ringKey);
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
      spin.on("pointerdown", () => pressFeedback(this, spin));
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
      const rules = this.add.container(702, 1403);
      const rulesHalo = this.add.circle(0, 0, 31, COLORS.ember, 0.12).setBlendMode(Phaser.BlendModes.ADD);
      const rulesPlate = this.add.circle(0, 0, 24, 0x160b16, 0.96).setStrokeStyle(2, COLORS.gold, 0.72);
      const rulesIcon = this.add.text(0, -1, "?", {
        fontFamily: DISPLAY_FONT, fontSize: "25px", color: "#ffe0a0", stroke: "#52150c", strokeThickness: 3,
      }).setOrigin(0.5);
      rules.add([rulesHalo, rulesPlate, rulesIcon]).setSize(60, 60).setInteractive({ useHandCursor: true });
      rules.on("pointerup", () => this.showRules());
      this.tweens.add({ targets: rulesHalo, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.1, to: 0.3 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    makeRoundButton(x, y, radius, label, onClick) {
      const button = this.add.container(x, y);
      const disc = this.add.circle(0, 0, radius, 0x2a1020, 1).setStrokeStyle(2, COLORS.gold, 0.8);
      const text = this.add.text(0, -2, label, {
        fontFamily: BODY_FONT, fontSize: "30px", fontStyle: "700", color: "#ffe4a3",
      }).setOrigin(0.5);
      button.add([disc, text]);
      button.setSize(radius * 2 + 16, radius * 2 + 16).setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => pressFeedback(this, button, 0.88));
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
      // Safety net: nothing may keep spinning once a round is over.
      if (this.phase === "idle") {
        this.reels?.forEach((reel) => {
          if (reel.state !== "stopped" && reel.state !== "idle") this.stopReel(reel, this.currentMarks());
        });
      }
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

    // Cosmetic only: blur and filler symbols. Real results always come from the server.
    randomSymbol() {
      return PHOENIX_SYMBOLS[Math.floor(Math.random() * PHOENIX_SYMBOLS.length)];
    }

    symbolForMark(mark) {
      return PHOENIX_SYMBOLS.find((symbol) => symbol.mark === mark) || PHOENIX_SYMBOLS[1];
    }

    startReels() {
      this.reels.forEach((reel, column) => {
        // Mark every reel as moving right away. Left as "stopped" from the previous round, a
        // reel still winding up would be skipped by a fast stop and then spin forever.
        reel.state = "starting";
        reel.speed = 0;
        this.tweens.killTweensOf([reel, ...reel.images]);
        reel.images.forEach((image, slot) => image.setY(REEL.centerY + (slot - 2) * REEL.pitch).setDisplaySize(REEL.size, REEL.size));
        // A short upward wind-up, then the strip drops into a blur.
        this.tweens.add({
          targets: reel.images,
          y: `-=${22}`,
          duration: 110,
          delay: column * 70,
          ease: "Sine.Out",
          onComplete: () => {
            if (reel.state !== "starting") return; // Already landed by a quick stop.
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
      // Lands the reel whether it is winding up or at full speed.
      this.tweens.killTweensOf([reel, ...reel.images]);
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
      if (this.phase === "spinning" && !this.finishQueued && this.reels.every((item) => item.state === "stopped")) {
        this.finishQueued = true;
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
      // Ignore tap bursts: one press is one action, even when a finger bounces or taps are mashed.
      const now = performance.now();
      if (now - this.lastSpinPress < SPIN_PRESS_GAP_MS) return;
      this.lastSpinPress = now;
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
      this.finishQueued = false;
      this.pendingRound = null;
      if (this.autoLeft > 0) this.autoLeft -= 1;
      this.refreshAuto();
      this.credits = Math.max(0, this.credits - this.bet);
      this.clearWin();
      this.setMessage(this.autoLeft > 0 ? "AUTO SPIN" : "TAP REELS TO STOP", "#ffd48b");
      this.spinLabel.setText("STOP");
      this.ringTween.timeScale = 8;
      this.tweens.add({ targets: this.aura, scale: { from: 1, to: 1.08 }, duration: 300, yoyo: true });
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
          timeout: SPIN_TIMEOUT_MS,
        });
        round = response.round;
      } catch (error) {
        if (this.leaving || !this.sys.isActive()) {
          window.GamishAccount?.refreshWallet().catch(() => {});
          return;
        }
        this.credits += this.bet;
        this.autoLeft = 0;
        this.failedSpin = error.message;
        this.pendingRound = { marks: this.currentMarks() };
        this.scheduleStops(this.pendingRound.marks);
        return;
      }
      if (this.leaving || !this.sys.isActive()) {
        if (round?.wallet && window.GamishAccount?.player) {
          Object.assign(window.GamishAccount.player, round.wallet);
          window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: window.GamishAccount.player }));
        }
        return;
      }
      this.pendingRound = round;
      const wait = this.quickStop ? 0 : Math.max(0, REEL.minSpinMs - (this.time.now - startedAt));
      this.stopEvents.push(this.time.delayedCall(wait, () => this.scheduleStops(round.marks)));
    }

    currentMarks() {
      return Array.from({ length: 9 }, () => this.randomSymbol().mark);
    }

    finishSpin() {
      const round = this.pendingRound;
      if (!round) return;
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
        // A timed-out request may still have been recorded, so take the balance from the server.
        window.GamishAccount.refreshWallet().then((player) => {
          if (!this.sys.isActive() || this.phase !== "idle") return;
          this.credits = Number(player.totalCredits || 0);
          this.refreshHud();
        }).catch(() => {});
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
      // A newer count on the same text replaces the old one, so a late tween can't overwrite it.
      text.getData("counter")?.remove();
      this.tweens.killTweensOf(text);
      const counter = { value: from };
      const tween = this.tweens.add({
        targets: counter,
        value: to,
        duration,
        ease: "Cubic.Out",
        onUpdate: () => text.setText(Math.round(counter.value).toLocaleString("en-US")),
        onComplete: () => text.setText(to.toLocaleString("en-US")),
      });
      text.setData("counter", tween);
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
      const countUp = this.tweens.add({
        targets: counter, value: payout, duration: 1100, ease: "Cubic.Out",
        onUpdate: () => amount.setText(`+${Math.round(counter.value).toLocaleString("en-US")}`),
      });

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
            destroyWithTweens(this, overlay, [countUp]);
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
        this.tweens.killTweensOf(this.betText);
        this.betText.setPosition(138, 1160).setScale(1);
        this.tweens.add({ targets: this.betText, x: 138 + direction * 6, duration: 50, yoyo: true, repeat: 1 });
        return;
      }
      this.bet = next;
      window.GamishAudio?.play("chip");
      buzz(6);
      this.tweens.killTweensOf(this.betText);
      this.betText.setPosition(138, 1160);
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
      const items = HOW_TO_PLAY.flatMap(([frame, heading, copy, color], index) => {
        const y = -150 + index * 130;
        return [
          this.add.image(-230, y, "phoenix-symbols-v2", frame).setDisplaySize(96, 96),
          this.add.text(-160, y - 30, heading, { fontFamily: BODY_FONT, fontSize: "18px", fontStyle: "700", color, letterSpacing: 2 }),
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
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        this.tweens.add({
          targets: sheet, alpha: 0, duration: 160,
          onComplete: () => { destroyWithTweens(this, sheet); this.overlay = null; },
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
      if (this.leaving) return;
      this.leaving = true;
      this.autoLeft = 0;
      this.phase = "leaving";
      this.stopEvents.forEach((event) => event.remove());
      this.stopEvents = [];
      if (this.pendingRound?.wallet && window.GamishAccount?.player) {
        Object.assign(window.GamishAccount.player, this.pendingRound.wallet);
        window.dispatchEvent(new CustomEvent("gamish:wallet", { detail: window.GamishAccount.player }));
      }
      window.GamishAccount?.refreshWallet().catch(() => {});
      setStatus("Returning to the Gamish777 game lobby.");
      this.cameras.main.fadeOut(220, 9, 4, 12);
      this.time.delayedCall(220, () => this.scene.start("GameZone"));
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: "game-shell",
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#08050c",
    transparent: false,
    // 120Hz phones would otherwise draw every frame twice; 60fps is plenty for this game.
    fps: { target: 60, limit: 60 },
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
    scene: [BootScene, WaitForPlayerScene, LandingScene, BrandLoaderScene, GameZoneScene, PhoenixGameScene],
    callbacks: {
      postBoot: (game) => {
        game.canvas.setAttribute("role", "application");
        game.canvas.setAttribute("aria-label", "Gamish777 interactive game lobby and game");
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
    window.addEventListener("gamish:signedout", () => game.scene.start("WaitForPlayer"));

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

    // Stop drawing while the wallet or messages page covers the game; resume where it left off.
    window.addEventListener("gamish:view", (event) => {
      if (event.detail === "arcade") game.loop.wake();
      else game.loop.sleep();
    });
  };

  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
})();
