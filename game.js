(() => {
  "use strict";

  // Every scene is laid out on a 1536×720 landscape stage. The canvas takes the screen's exact
  // aspect ratio and each camera centres the stage inside the safe area (clear of the notch and
  // home bar), so background art fills the whole screen instead of leaving letterbox bars.
  const WIDTH = 1536;
  const HEIGHT = 720;
  const BLEED = 700;
  // Hard ceiling on canvas pixels. iOS kills a page whose WebGL buffers outgrow its memory
  // allowance ("A problem repeatedly occurred"), so the render scale bends to fit this budget.
  const MAX_CANVAS_PIXELS = 2_600_000;
  // Phones held upright see the rotate prompt; the game behind it stays landscape-sized and asleep.
  const PORTRAIT_PROMPT = window.matchMedia("(orientation: portrait) and (max-width: 900px) and (pointer: coarse)");
  const VIEW = { width: WIDTH, height: HEIGHT, left: 0, top: 0, zoom: 1 };

  // Notch-aware safe margins (see safe-area.js): full margin on the notch side only.
  const readSafeInsets = () => window.GamishSafeArea?.read() ?? { top: 0, right: 0, bottom: 0, left: 0 };

  const measureView = () => {
    const shell = document.getElementById("game-shell");
    let cssWidth = shell?.clientWidth || window.innerWidth;
    let cssHeight = shell?.clientHeight || window.innerHeight;
    if (!cssWidth || !cssHeight) return { width: WIDTH, height: HEIGHT, left: 0, top: 0, zoom: 1 };
    const portrait = PORTRAIT_PROMPT.matches;
    // Upright, measure as if the phone were already turned: no tall, memory-hungry canvas.
    if (portrait) [cssWidth, cssHeight] = [Math.max(cssWidth, cssHeight), Math.min(cssWidth, cssHeight)];
    const insets = portrait ? { top: 0, right: 0, bottom: 0, left: 0 } : readSafeInsets();
    const safeWidth = Math.max(1, cssWidth - insets.left - insets.right);
    const safeHeight = Math.max(1, cssHeight - insets.top - insets.bottom);
    const scale = Math.min(safeWidth / WIDTH, safeHeight / HEIGHT); // CSS px per stage unit
    const width = Math.round(cssWidth / scale);
    const height = Math.round(cssHeight / scale);
    // Render closer to the screen's real pixel density so text and art stay sharp on
    // high-density phones, within a pixel budget that keeps the frame rate smooth.
    const density = Math.min(window.devicePixelRatio || 1, 3);
    let zoom = Phaser.Math.Clamp((cssWidth * density) / width, 1, 1.5);
    // The budget always wins, even if that means rendering a little below the stage size.
    zoom = Math.min(zoom, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
    zoom = Math.max(0.5, Math.floor(zoom * 8) / 8);
    return {
      width,
      height,
      left: Math.round((insets.left + (safeWidth - WIDTH * scale) / 2) / scale),
      top: Math.round((insets.top + (safeHeight - HEIGHT * scale) / 2) / scale),
      zoom,
    };
  };

  // The stage's visible extent in stage coordinates (wider or taller than the stage itself).
  const visibleLeft = () => -VIEW.left;
  const visibleRight = () => VIEW.width - VIEW.left;

  const placeBackground = (image) => {
    const source = image.texture.getSourceImage();
    image.setPosition(VIEW.width / 2 - VIEW.left, VIEW.height / 2 - VIEW.top);
    image.setScale(Math.max(VIEW.width / source.width, VIEW.height / source.height));
  };

  const applyView = (scene) => {
    const camera = scene.cameras.main;
    camera.setSize(Math.round(VIEW.width * VIEW.zoom), Math.round(VIEW.height * VIEW.zoom));
    camera.setZoom(VIEW.zoom);
    camera.centerOn(VIEW.width / 2 - VIEW.left, VIEW.height / 2 - VIEW.top);
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
  const GAME_ART_BY_CELL = new Map(GAME_ART_CELLS.map(([, x, y], index) => [`${x},${y}`, `game-art-${index}`]));
  // Phoenix Ruby's featured card shows while the game is on; its name follows the registry.
  const PHOENIX = { live: true, name: "Phoenix Ruby" };

  // The lobby from the game registry (admin → Games): the games that are on, in the admin's
  // order, with their names, categories and logos. Returns false when there is no registry
  // (offline, or the server is down) so the built-in list is used instead.
  const applyGameRegistry = (rows, catalog) => {
    if (!Array.isArray(rows) || !rows.length) return false;
    const modules = new Map((catalog?.games || []).filter((entry) => entry.runtime === "module").map((entry) => [entry.id, entry]));
    GAME_CATEGORIES.slice(1).forEach((category) => { category.games = []; });
    GAME_CATEGORIES[0].games = [];
    PHOENIX.live = false;
    for (const row of rows) {
      const category = GAME_CATEGORIES.find((item) => item.name === row.category) || GAME_CATEGORIES.at(-1);
      const game = {
        id: row.id,
        title: row.name,
        icon: "✦",
        category: category.name,
        accent: category.accent,
        art: row.artCell ? GAME_ART_BY_CELL.get(`${row.artCell[0]},${row.artCell[1]}`) : GAME_ART_BY_TITLE.get(row.name),
        // Uploaded logo first, then the game's own cover art (both loaded in Boot).
        cover: row.logoUrl ? `logo:${row.id}` : row.coverUrl ? `cover:${row.id}` : null,
        playable: row.id === "phoenix-ruby",
        module: modules.get(row.id) || null,
      };
      if (game.playable) Object.assign(PHOENIX, { live: true, name: row.name });
      category.games.push(game);
      GAME_CATEGORIES[0].games.push(game);
    }
    return true;
  };

  // Module games from games/catalog.json: a lobby tile with the same title becomes playable,
  // and a new title gets its own tile (with its cover art) in its category. Playable games
  // lead their category.
  const applyGameCatalog = (catalog) => {
    for (const entry of catalog?.games || []) {
      if (entry.runtime !== "module") continue;
      const category = GAME_CATEGORIES.find((item) => item.name === entry.category) || GAME_CATEGORIES.at(-1);
      let game = category.games.find((item) => item.title === entry.title);
      if (!game) {
        game = {
          title: entry.title, icon: "✦", playable: false, category: category.name,
          accent: Number.parseInt((entry.accent || "#ffc96b").slice(1), 16), art: GAME_ART_BY_TITLE.get(entry.title),
        };
        category.games.push(game);
      }
      game.module = entry;
      if (entry.cover) game.cover = `cover:${entry.id}`;
    }
    GAME_CATEGORIES.slice(1).forEach((category) => {
      category.games.sort((a, b) => Number(Boolean(b.playable || b.module)) - Number(Boolean(a.playable || a.module)));
    });
    GAME_CATEGORIES[0].games = GAME_CATEGORIES.slice(1).flatMap((category) => category.games)
      .sort((a, b) => Number(Boolean(b.playable || b.module)) - Number(Boolean(a.playable || a.module)));
  };

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
    addGradient(scene, -BLEED, 0, span, 140, [[0, `rgba(7,4,11,${top})`], [1, "rgba(7,4,11,0)"]], `fade-down:${top}`);
    addGradient(scene, -BLEED, HEIGHT - 170, span, 170, [[0, "rgba(7,4,11,0)"], [1, `rgba(7,4,11,${bottom})`]], `fade-up:${bottom}`);
    scene.add.rectangle(WIDTH / 2, HEIGHT + BLEED / 2, span, BLEED, 0x07040b, bottom);
  };

  // Small circular icon buttons (sound, wallet, chat, profile). Icons are baked once into textures.
  const ICON_DRAWERS = {
    profile: (g) => {
      g.lineStyle(2.4, COLORS.ivory, 0.96).strokeCircle(24, 19, 5.5);
      g.fillStyle(COLORS.ivory, 0.96).fillEllipse(24, 34, 22, 11);
    },
    payments: (g) => {
      g.lineStyle(2.4, COLORS.ivory, 0.96).strokeRoundedRect(13, 16, 22, 17, 4).strokeRoundedRect(27, 21, 11, 8, 3);
      g.fillStyle(COLORS.ivory, 1).fillCircle(30, 25, 1.6);
    },
    chat: (g) => {
      g.lineStyle(2.4, COLORS.ivory, 0.96).strokeRoundedRect(13, 15, 22, 17, 5);
      g.beginPath().moveTo(19, 32).lineTo(15, 36).lineTo(16, 29).strokePath();
      [20, 24, 28].forEach((x) => g.fillStyle(COLORS.ivory, 0.95).fillCircle(x, 24, 1.4));
    },
    sound: (g) => {
      g.fillStyle(COLORS.ivory, 0.96).fillPoints([
        new Phaser.Geom.Point(13, 20), new Phaser.Geom.Point(18, 20), new Phaser.Geom.Point(24, 14),
        new Phaser.Geom.Point(24, 34), new Phaser.Geom.Point(18, 28), new Phaser.Geom.Point(13, 28),
      ], true);
      g.lineStyle(2.2, COLORS.ivory, 0.96);
      g.beginPath().arc(26, 24, 5, -0.9, 0.9).strokePath();
      g.beginPath().arc(26, 24, 10, -0.9, 0.9).strokePath();
    },
    muted: (g) => {
      g.fillStyle(COLORS.ivory, 0.6).fillPoints([
        new Phaser.Geom.Point(13, 20), new Phaser.Geom.Point(18, 20), new Phaser.Geom.Point(24, 14),
        new Phaser.Geom.Point(24, 34), new Phaser.Geom.Point(18, 28), new Phaser.Geom.Point(13, 28),
      ], true);
      g.lineStyle(2.4, 0xff8a6b, 1).lineBetween(28, 19, 37, 29).lineBetween(37, 19, 28, 29);
    },
  };

  const addIconButton = (scene, x, y, kind, onTap, { label = "" } = {}) => {
    const iconKey = (name) => bakeGraphics(scene, `icon:${name}`, 48, 48, ICON_DRAWERS[name]);
    const button = scene.add.container(x, y);
    const disk = scene.add.circle(0, 0, 30, 0x34142a, 0.95);
    const shine = scene.add.ellipse(0, -14, 34, 14, 0xffd9a0, 0.1);
    const icon = scene.add.image(0, 0, iconKey(kind));
    button.add([disk, shine, icon]).setSize(76, 76).setInteractive({ useHandCursor: true });
    button.setData("label", label);
    button.setIcon = (name) => icon.setTexture(iconKey(name));
    button.on("pointerdown", () => pressFeedback(scene, button, 0.88));
    button.on("pointerup", () => {
      window.GamishAudio?.play("nav");
      if (label) setStatus(label);
      onTap(button);
    });
    return button;
  };

  const addSoundButton = (scene, x, y) => {
    const audio = window.GamishAudio;
    const button = addIconButton(scene, x, y, audio?.isEnabled() ? "sound" : "muted", () => {
      audio?.toggle();
    }, { label: "Sound" });
    const sync = () => button.setIcon(audio?.isEnabled() ? "sound" : "muted");
    window.addEventListener("gamish:soundchange", sync);
    scene.events.once("shutdown", () => window.removeEventListener("gamish:soundchange", sync));
    return button;
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

  // ctx.roundRect is missing on older iOS, so trace the corners by hand.
  const roundRectPath = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  // Texture detail matched to the canvas resolution (the stage renders at VIEW.zoom).
  const textureScale = () => Math.min(1.5, Math.max(1, Math.round(VIEW.zoom * 4) / 4));
  const mixColor = (hex, target, amount) => {
    const channel = (shift) => Math.round(((hex >> shift) & 255) * (1 - amount) + ((target >> shift) & 255) * amount);
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  };

  // Panels are smooth, softly lit plates without outlines: a gentle top-to-bottom gradient, a
  // glassy sheen and a soft drop shadow. (The old hand-drawn gold outline read as a dull thread.)
  const addOrnatePanel = (scene, x, y, width, height, options = {}) => {
    const w = Math.round(width);
    const h = Math.round(height);
    const fill = options.fill ?? COLORS.panel;
    const alpha = options.fillAlpha ?? 0.94;
    const radius = Math.min(options.bend ?? 28, h / 2, w / 2);
    const scale = textureScale();
    const key = `panel2:${w}x${h}:${fill}:${alpha}:${radius}:${scale}`;
    if (!scene.textures.exists(key)) {
      const pad = PANEL_PAD;
      const texture = scene.textures.createCanvas(key, Math.ceil((w + pad * 2) * scale), Math.ceil((h + pad * 2) * scale));
      const ctx = texture.getContext();
      ctx.scale(scale, scale);
      const plate = () => {
        ctx.beginPath();
        roundRectPath(ctx, pad, pad, w, h, radius);
      };
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = Math.min(14, pad - 2);
      ctx.shadowOffsetY = 4;
      const face = ctx.createLinearGradient(0, pad, 0, pad + h);
      face.addColorStop(0, mixColor(fill, 0xffd9a0, 0.1));
      face.addColorStop(1, mixColor(fill, 0x000000, 0.12));
      ctx.globalAlpha = alpha;
      plate();
      ctx.fillStyle = face;
      ctx.fill();
      ctx.restore();
      // Light catching the upper half.
      ctx.save();
      plate();
      ctx.clip();
      const sheen = ctx.createLinearGradient(0, pad, 0, pad + Math.min(h * 0.55, 60));
      sheen.addColorStop(0, "rgba(255, 226, 170, 0.12)");
      sheen.addColorStop(1, "rgba(255, 226, 170, 0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(pad, pad, w, h);
      ctx.restore();
      texture.refresh();
    }
    return scene.add.image(x, y, key).setScale(1 / scale);
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
      const disk = scene.add.circle(0, 0, 34, 0x3a1626, 0.96);
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
      // The game catalogue (generated from games/*/game.json) and any module game covers.
      this.load.json("games-catalog", "games/catalog.json");
      // The registry: which games are on, their names, order and logos.
      this.load.json("games-registry", "/api/game/spin");
      this.load.once("filecomplete-json-games-registry", (key, type, registry) => {
        (registry?.games || []).forEach((row) => {
          if (row.logoUrl) this.load.image(`logo:${row.id}`, row.logoUrl);
          else if (row.coverUrl) this.load.image(`cover:${row.id}`, row.coverUrl);
        });
      });
      this.load.once("filecomplete-json-games-catalog", (key, type, catalog) => {
        (catalog?.games || []).forEach((entry) => {
          if (entry.cover) this.load.image(`cover:${entry.id}`, entry.cover);
        });
      });
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
      const catalog = this.cache.json.get("games-catalog");
      if (!applyGameRegistry(this.cache.json.get("games-registry")?.games, catalog)) applyGameCatalog(catalog);
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
        // The cinematic intro plays once per session; later sign-ins go straight to the lobby.
        let seen = false;
        try {
          seen = window.sessionStorage.getItem("gamish777-intro") === "seen";
          window.sessionStorage.setItem("gamish777-intro", "seen");
        } catch { /* storage may be unavailable */ }
        this.scene.start(seen ? "BrandLoader" : "Landing");
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
          scale: scale * 1.1,
          duration: 1500,
          delay: index * 1600,
          yoyo: true,
          hold: 500,
          ease: "Sine.InOut",
        });
        return art;
      });
      const aura = this.add.circle(WIDTH / 2, 330, 250, COLORS.ember, 0.08).setBlendMode(Phaser.BlendModes.ADD);
      const ring = this.add.circle(WIDTH / 2, 330, 196, 0x120812, 0.08).setStrokeStyle(2, COLORS.gold, 0.55);
      this.tweens.add({ targets: aura, scale: { from: 0.8, to: 1.25 }, alpha: { from: 0.06, to: 0.18 }, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: ring, angle: 360, duration: 18000, repeat: -1 });
      this.add.text(WIDTH / 2, 300, "GAMISH777", {
        fontFamily: DISPLAY_FONT, fontSize: "52px", color: "#fff0c0", stroke: "#621b0a", strokeThickness: 8,
        shadow: { offsetY: 7, color: "#000000", blur: 18, fill: true },
      }).setOrigin(0.5).setDepth(5);
      this.add.text(WIDTH / 2, 368, "A WORLD OF GAMES", {
        fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#ffe0a4", letterSpacing: 8,
      }).setOrigin(0.5).setDepth(5);
      addRule(this, 420, 470).setDepth(5);
      this.add.text(WIDTH / 2, 640, "TAP ANYWHERE TO ENTER", {
        fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#fff0c0", letterSpacing: 5,
      }).setOrigin(0.5).setDepth(5);

      const skip = this.add.container(visibleRight() - 90, 70).setDepth(10);
      skip.add([
        this.add.circle(0, 0, 44, 0x170b16, 0.72).setStrokeStyle(2, COLORS.gold, 0.64),
        this.add.text(0, 0, "SKIP  ›", { fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#fff0c0", letterSpacing: 1 }).setOrigin(0.5),
      ]);
      skip.setSize(94, 94).setInteractive({ useHandCursor: true });
      skip.on("pointerup", () => this.openLoader());
      this.input.once("pointerup", () => this.openLoader());
      this.cameras.main.fadeIn(400, 7, 4, 11);
      this.time.delayedCall(7600, () => this.openLoader());
      this.events.once("shutdown", () => {
        slides.forEach((slide) => this.tweens.killTweensOf(slide));
        this.time.removeAllEvents();
      });
      this.leaving = false;
      this.handleBack = () => this.openLoader();
      this.openLoader = () => {
        if (this.leaving) return;
        this.leaving = true;
        window.GamishAudio?.play("nav");
        this.cameras.main.fadeOut(220, 7, 4, 11);
        this.time.delayedCall(220, () => this.scene.start("BrandLoader"));
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
      const crest = this.add.image(WIDTH / 2, 250, "phoenix-symbols-v2", "symbol-8").setDisplaySize(155, 155);
      const halo = this.add.circle(WIDTH / 2, 250, 100, COLORS.ember, 0.1).setBlendMode(Phaser.BlendModes.ADD);
      const orbit = this.add.circle(WIDTH / 2, 250, 115, 0x000000, 0).setStrokeStyle(3, COLORS.gold, 0.8);
      this.tweens.add({ targets: crest, y: 238, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: halo, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.08, to: 0.24 }, duration: 900, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: orbit, angle: 360, duration: 3600, repeat: -1 });
      this.add.text(WIDTH / 2, 420, "GAMISH777", {
        fontFamily: DISPLAY_FONT, fontSize: "43px", color: "#fff0c0", stroke: "#621b0a", strokeThickness: 7,
      }).setOrigin(0.5);
      this.add.text(WIDTH / 2, 478, "PREPARING YOUR LOBBY", {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#f4c98e", letterSpacing: 5,
      }).setOrigin(0.5);
      const track = addOrnatePanel(this, WIDTH / 2, 548, 420, 18, {
        fill: 0x4b2a38, fillAlpha: 0.65, stroke: COLORS.gold, strokeAlpha: 0.3, lineWidth: 1, bend: 7, anchors: false,
      });
      track.setAlpha(0.45);
      const bar = this.add.rectangle(WIDTH / 2 - 206, 548, 4, 8, COLORS.ember).setOrigin(0, 0.5);
      this.tweens.add({ targets: bar, width: 408, duration: 750, ease: "Sine.InOut" });
      this.time.delayedCall(850, () => this.scene.start("GameZone"));
    }
  }

  // Category chips: a lacquered pill with a gold rim and, for the chosen one, a glowing gold face.
  // Drawn with the 2D canvas (gradients, glow) at twice the stage size, once per width.
  const CHIP_HEIGHT = 48;
  const chipPlateTexture = (scene, width, on, accent) => {
    const scale = textureScale();
    const key = `chip-plate:${width}:${on ? 1 : 0}:${accent}:${scale}`;
    if (scene.textures.exists(key)) return key;
    const pad = 8;
    const texture = scene.textures.createCanvas(key, Math.ceil((width + pad * 2) * scale), Math.ceil((CHIP_HEIGHT + pad * 2) * scale));
    const ctx = texture.getContext();
    ctx.scale(scale, scale);
    const x = pad;
    const y = pad;
    const r = CHIP_HEIGHT / 2;
    const pill = () => {
      ctx.beginPath();
      roundRectPath(ctx, x, y, width, CHIP_HEIGHT, r);
    };
    if (on) {
      ctx.save();
      ctx.shadowColor = "rgba(255, 150, 40, 0.65)";
      ctx.shadowBlur = 12;
      const face = ctx.createLinearGradient(0, y, 0, y + CHIP_HEIGHT);
      face.addColorStop(0, "#ffe7a3");
      face.addColorStop(0.5, "#ffbf4f");
      face.addColorStop(1, "#f07a1c");
      pill();
      ctx.fillStyle = face;
      ctx.fill();
      ctx.restore();
      const shine = ctx.createLinearGradient(0, y, 0, y + CHIP_HEIGHT / 2);
      shine.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      shine.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.beginPath();
      roundRectPath(ctx, x + 4, y + 2, width - 8, CHIP_HEIGHT / 2 - 2, 11);
      ctx.fillStyle = shine;
      ctx.fill();
      pill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 246, 214, 0.9)";
      ctx.stroke();
    } else {
      const face = ctx.createLinearGradient(0, y, 0, y + CHIP_HEIGHT);
      face.addColorStop(0, "rgba(46, 22, 40, 0.96)");
      face.addColorStop(1, "rgba(22, 10, 22, 0.96)");
      pill();
      ctx.fillStyle = face;
      ctx.fill();
      const rim = ctx.createLinearGradient(x, 0, x + width, 0);
      rim.addColorStop(0, "rgba(255, 210, 128, 0.7)");
      rim.addColorStop(0.5, "rgba(255, 210, 128, 0.22)");
      rim.addColorStop(1, "rgba(255, 210, 128, 0.5)");
      pill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rim;
      ctx.stroke();
    }
    texture.refresh();
    return key;
  };

  // Category icons are real game art from the lobby sheet, cropped into a gold-ringed medallion.
  const CATEGORY_ART = {
    "All Games": null, // the Phoenix Ruby key art
    Slots: "Classic 777",
    Instant: "Crash",
    Cards: "Blackjack",
    "Table Games": "Roulette",
    Numbers: "Keno",
    Arcade: "Fishing",
    "Quick Games": "Scratch Card",
  };
  const MEDALLION = 60;
  const categoryArtTexture = (scene, category) => {
    const scale = textureScale();
    const key = `category-art:${category.name}:${scale}`;
    if (scene.textures.exists(key)) return key;
    const size = MEDALLION + 6;
    const texture = scene.textures.createCanvas(key, Math.ceil(size * scale), Math.ceil(size * scale));
    const ctx = texture.getContext();
    ctx.scale(scale, scale);
    const c = size / 2;
    const r = MEDALLION / 2;
    const title = CATEGORY_ART[category.name];
    const frame = title ? scene.textures.getFrame("gamish-game-icons", GAME_ART_BY_TITLE.get(title)) : scene.textures.getFrame("phoenix");
    // Square crop from the upper part of the tile, above the printed game title.
    const side = title ? Math.min(frame.cutWidth, frame.cutHeight) * 0.74 : Math.min(frame.cutWidth, frame.cutHeight) * 0.62;
    const sx = frame.cutX + (frame.cutWidth - side) / 2;
    const sy = frame.cutY + (title ? frame.cutHeight * 0.05 : frame.cutHeight * 0.16);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = "#140a12";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r - 1.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(frame.source.image, sx, sy, side, side, c - r, c - r, MEDALLION, MEDALLION);
    // A little glassy light across the top.
    const gloss = ctx.createLinearGradient(0, c - r, 0, c);
    gloss.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    gloss.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(c - r, c - r, MEDALLION, r);
    ctx.restore();
    const ring = ctx.createLinearGradient(0, c - r, 0, c + r);
    ring.addColorStop(0, "#fff1c2");
    ring.addColorStop(0.5, "#e9a640");
    ring.addColorStop(1, "#8a4b12");
    ctx.beginPath();
    ctx.arc(c, c, r - 1, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ring;
    ctx.stroke();
    texture.refresh();
    return key;
  };

  // Lobby geometry on the landscape stage.
  const LOBBY = {
    barY: 64,
    chipsY: 140,
    top: 180,
    bottom: 690,
    rows: [312, 560],
    tile: 228,
    colStep: 246,
    margin: 40,
    featuredWidth: 470,
  };

  class GameZoneScene extends Phaser.Scene {
    constructor() {
      super("GameZone");
      this.modal = null;
    }

    create() {
      this.modal = null;
      this.cards = [];
      this.scrollX = 0;
      this.velocity = 0;
      this.drag = null;
      this.suppressTap = false;
      this.category = GAME_CATEGORIES[0];
      setStatus("Gamish777 game lobby. Swipe through games, pick a category, or open your wallet and chat.");
      this.cameras.main.setBackgroundColor("#0b0710");
      applyView(this);
      this.add.circle(260, 420, 340, 0x942c26, 0.07).setBlendMode(Phaser.BlendModes.ADD);
      this.add.circle(1250, 520, 380, 0x3b2069, 0.08).setBlendMode(Phaser.BlendModes.ADD);
      addAtmosphere(this, 14, [0xffad42, 0x6ee7ea, 0xd994ff]);

      this.content = this.add.container(0, 0);
      this.createTopBar();
      this.createCategoryChips();
      this.createScrollIndicator();
      this.renderCatalog();

      this.input.on("pointerdown", (pointer) => this.onPointerDown(pointer));
      this.input.on("pointermove", (pointer) => this.onPointerMove(pointer));
      this.input.on("pointerup", (pointer) => this.onPointerUp(pointer));
      this.input.on("pointerupoutside", (pointer) => this.onPointerUp(pointer));
      this.input.on("gameout", () => this.onPointerUp());
      this.input.on("wheel", (pointer, objects, deltaX, deltaY) => {
        if (this.modal) return;
        this.velocity = 0;
        this.setScroll(this.scrollX + (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY), true);
      });
      this.input.keyboard?.on("keydown-ESC", () => (this.modal ? this.closeModal() : this.glideTo(0)));
      this.input.keyboard?.on("keydown-RIGHT", () => this.glideTo(this.scrollX + LOBBY.colStep * 3));
      this.input.keyboard?.on("keydown-LEFT", () => this.glideTo(this.scrollX - LOBBY.colStep * 3));

      this.walletListener = () => this.refreshBalance();
      window.addEventListener("gamish:wallet", this.walletListener);
      this.events.on("viewchange", () => this.measureScroll());
      this.events.once("shutdown", () => window.removeEventListener("gamish:wallet", this.walletListener));
      this.cameras.main.fadeIn(360, 9, 5, 12);
    }

    // ---------- Header ----------

    createTopBar() {
      const left = Math.max(visibleLeft() + LOBBY.margin, LOBBY.margin);
      this.add.text(left, LOBBY.barY, "GAMISH777", {
        fontFamily: DISPLAY_FONT, fontSize: "34px", color: "#fff1c6",
        shadow: { offsetY: 5, color: "#000000", blur: 16, fill: true },
      }).setOrigin(0, 0.5);

      const right = Math.min(visibleRight() - LOBBY.margin, WIDTH - LOBBY.margin) - 30;
      addIconButton(this, right, LOBBY.barY, "profile", () => this.openProfile(), { label: "Player profile" });
      addSoundButton(this, right - 78, LOBBY.barY);
      addIconButton(this, right - 156, LOBBY.barY, "chat", () => this.openAppView("messages"), { label: "Chat with support" });

      // Balance pill doubles as the way into the wallet.
      const pill = this.add.container(right - 330, LOBBY.barY);
      const plate = addOrnatePanel(this, 0, 0, 236, 62, { fill: 0x34142a, fillAlpha: 0.95, bend: 31 });
      this.balanceText = this.add.text(-96, 0, "$0.00", {
        fontFamily: BODY_FONT, fontSize: "24px", fontStyle: "700", color: "#fff0c0",
      }).setOrigin(0, 0.5);
      const add = this.add.circle(86, 0, 21, COLORS.ember, 1);
      const plus = this.add.text(86, -2, "+", { fontFamily: BODY_FONT, fontSize: "30px", fontStyle: "700", color: "#2a0d06" }).setOrigin(0.5);
      pill.add([plate, this.balanceText, add, plus]).setSize(236, 70).setInteractive({ useHandCursor: true });
      pill.on("pointerdown", () => pressFeedback(this, pill, 0.95));
      pill.on("pointerup", () => {
        window.GamishAudio?.play("nav");
        this.openAppView("payments");
      });
      this.refreshBalance();
    }

    refreshBalance() {
      const cents = Number(window.GamishAccount?.player?.totalCredits || 0);
      this.balanceText?.setText(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100));
    }

    createCategoryChips() {
      this.chips = [];
      const left = Math.max(visibleLeft() + LOBBY.margin, LOBBY.margin);
      const room = Math.min(visibleRight(), WIDTH) - LOBBY.margin - left;
      const build = (fontSize, gap) => {
        this.chips.forEach(({ chip }) => chip.destroy());
        this.chips = [];
        let x = left;
        // Categories with no games switched on are left out (All Games always shows).
        GAME_CATEGORIES.filter((category, index) => index === 0 || category.games.length).forEach((category) => {
          const text = this.add.text(0, 0, category.name.toUpperCase(), {
            fontFamily: BODY_FONT, fontSize: `${fontSize}px`, fontStyle: "700", color: "#f1dcc0", letterSpacing: 1.4,
          }).setOrigin(0, 0.5);
          const width = Math.ceil(text.width) + 86;
          const chip = this.add.container(x + width / 2, LOBBY.chipsY);
          const plate = this.add.image(0, 0, chipPlateTexture(this, width, false, category.accent)).setScale(1 / textureScale());
          const active = this.add.image(0, 0, chipPlateTexture(this, width, true, category.accent)).setScale(1 / textureScale()).setAlpha(0);
          // The art medallion sits like a badge on the pill's left end, a little larger than it.
          const icon = this.add.image(-width / 2 + 26, 0, categoryArtTexture(this, category)).setScale(1 / textureScale());
          text.setX(-width / 2 + 64);
          chip.add([plate, active, icon, text]).setSize(width, 64).setInteractive({ useHandCursor: true });
          chip.on("pointerdown", () => pressFeedback(this, chip, 0.94));
          chip.on("pointerup", () => this.selectCategory(category));
          this.chips.push({ category, chip, active, icon, text });
          x += width + gap;
        });
        return x - gap - left;
      };
      // Keep the whole row on screen: tighten the type a step at a time on narrow phones.
      for (const [fontSize, gap] of [[15, 12], [14, 9], [13, 7], [12, 6]]) {
        if (build(fontSize, gap) <= room) break;
      }
      this.refreshChips();
    }

    refreshChips() {
      this.chips.forEach(({ category, active, icon, text }) => {
        const on = category === this.category;
        this.tweens.add({ targets: active, alpha: on ? 1 : 0, duration: 160 });
        this.tweens.add({ targets: icon, scale: (on ? 1.08 : 1) / textureScale(), duration: 180, ease: "Back.Out" });
        text.setColor(on ? "#2a0e05" : "#f1dcc0");
      });
    }

    selectCategory(category) {
      if (category === this.category) {
        this.glideTo(0);
        return;
      }
      window.GamishAudio?.play("chip");
      this.category = category;
      this.refreshChips();
      this.renderCatalog(true);
      setStatus(`${category.name}: ${category.games.length} games.`);
    }

    // ---------- Catalog ----------

    renderCatalog(animate = false) {
      this.cards.forEach((card) => destroyWithTweens(this, card));
      this.cards = [];
      this.content.removeAll(true);
      this.velocity = 0;
      this.scrollX = 0;

      const showFeatured = PHOENIX.live && (this.category === GAME_CATEGORIES[0] || this.category.name === "Slots");
      let x = Math.max(visibleLeft() + LOBBY.margin, LOBBY.margin);
      if (showFeatured) {
        this.addFeatured(x + LOBBY.featuredWidth / 2);
        x += LOBBY.featuredWidth + 30;
      }
      const games = this.category.games.filter((game) => !(showFeatured && game.playable));
      games.forEach((game, index) => {
        const column = Math.floor(index / 2);
        const cx = x + LOBBY.tile / 2 + column * LOBBY.colStep;
        const cy = LOBBY.rows[index % 2];
        const card = this.addGameCard(game, cx, cy);
        if (animate) {
          card.setAlpha(0).setY(cy + 18);
          this.tweens.add({ targets: card, alpha: 1, y: cy, duration: 220, delay: Math.min(column, 6) * 28, ease: "Cubic.Out" });
        }
      });
      const columns = Math.ceil(games.length / 2);
      this.contentRight = x + Math.max(0, columns) * LOBBY.colStep - (LOBBY.colStep - LOBBY.tile) + LOBBY.margin;
      this.measureScroll();
      this.applyScroll();
    }

    addFeatured(cx) {
      const height = LOBBY.rows[1] - LOBBY.rows[0] + LOBBY.tile;
      const cy = (LOBBY.rows[0] + LOBBY.rows[1]) / 2;
      const card = this.add.container(cx, cy);
      const glow = this.add.circle(0, 0, 300, COLORS.ember, 0.07).setBlendMode(Phaser.BlendModes.ADD);
      const plate = addSoftPanel(this, 0, 0, LOBBY.featuredWidth, height, { fill: 0x1a0d1a, alpha: 0.94, radius: 40 });
      const art = this.add.image(0, -60, "phoenix");
      art.setScale(Math.max((LOBBY.featuredWidth - 24) / art.width, (height - 150) / art.height));
      art.setCrop(
        (art.width - (LOBBY.featuredWidth - 24) / art.scaleX) / 2,
        (art.height - (height - 150) / art.scaleY) / 2,
        (LOBBY.featuredWidth - 24) / art.scaleX,
        (height - 150) / art.scaleY,
      );
      const shade = addGradient(this, -LOBBY.featuredWidth / 2 + 12, height / 2 - 230, LOBBY.featuredWidth - 24, 140,
        [[0, "rgba(26,13,26,0)"], [1, "rgba(26,13,26,1)"]], "featured-shade");
      const badge = addSoftPanel(this, -LOBBY.featuredWidth / 2 + 100, -height / 2 + 40, 150, 38, { fill: COLORS.ember, alpha: 1, radius: 19 });
      const badgeText = this.add.text(-LOBBY.featuredWidth / 2 + 100, -height / 2 + 40, "★ FEATURED", {
        fontFamily: BODY_FONT, fontSize: "15px", fontStyle: "700", color: "#2a0d06", letterSpacing: 1,
      }).setOrigin(0.5);
      const title = this.add.text(-LOBBY.featuredWidth / 2 + 30, height / 2 - 86, PHOENIX.name.toUpperCase(), {
        fontFamily: DISPLAY_FONT, fontSize: "30px", color: "#fff0c2",
        shadow: { offsetY: 3, color: "#000000", blur: 10, fill: true },
      }).setOrigin(0, 0.5);
      const meta = this.add.text(-LOBBY.featuredWidth / 2 + 30, height / 2 - 46, "3-reel slot  ·  wins up to 3×", {
        fontFamily: BODY_FONT, fontSize: "17px", color: "#d9c0b4",
      }).setOrigin(0, 0.5);
      const play = addSoftPanel(this, LOBBY.featuredWidth / 2 - 92, height / 2 - 64, 140, 60, { fill: COLORS.ember, alpha: 1, radius: 30 });
      const playText = this.add.text(LOBBY.featuredWidth / 2 - 92, height / 2 - 66, "PLAY ›", {
        fontFamily: BODY_FONT, fontSize: "22px", fontStyle: "700", color: "#2a0d06",
      }).setOrigin(0.5);
      card.add([glow, plate, art, shade, badge, badgeText, title, meta, play, playText]);
      this.tweens.add({ targets: glow, alpha: { from: 0.04, to: 0.12 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.makeTappable(card, LOBBY.featuredWidth, height, () => this.launchPhoenix());
      this.content.add(card);
      this.cards.push(card);
    }

    addGameCard(game, cx, cy) {
      const card = this.add.container(cx, cy);
      const halo = this.add.circle(0, 0, LOBBY.tile * 0.58, game.accent, 0.05).setBlendMode(Phaser.BlendModes.ADD);
      // An uploaded logo wins, then the lobby art sheet, then the Phoenix key art.
      const art = game.cover && this.textures.exists(game.cover)
        ? this.add.image(0, 0, game.cover)
        : game.art ? this.add.image(0, 0, "gamish-game-icons", game.art) : this.add.image(0, 0, "phoenix");
      art.setDisplaySize(LOBBY.tile, LOBBY.tile);
      card.add([halo, art]);
      if (game.playable || game.module) {
        const tag = addSoftPanel(this, 0, LOBBY.tile / 2 - 6, 120, 34, { fill: COLORS.ember, alpha: 1, radius: 17 });
        const tagText = this.add.text(0, LOBBY.tile / 2 - 7, "PLAY ›", { fontFamily: BODY_FONT, fontSize: "16px", fontStyle: "700", color: "#2a0d06" }).setOrigin(0.5);
        card.add([tag, tagText]);
      }
      this.makeTappable(card, LOBBY.tile, LOBBY.tile, () => {
        if (game.playable) this.launchPhoenix();
        else if (game.module) this.launchModule(game.module);
        else this.openGameModal(game);
      });
      this.content.add(card);
      this.cards.push(card);
      return card;
    }

    // Press in on touch, fire on release only if the finger didn't scroll or stop a glide.
    makeTappable(card, width, height, action) {
      card.setSize(width, height).setInteractive({ useHandCursor: true });
      card.on("pointerdown", () => {
        if (this.suppressTap || this.modal) return;
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 0.95, duration: 90, ease: "Quad.Out" });
      });
      const release = () => {
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1, duration: 160, ease: "Back.Out" });
      };
      card.on("pointerout", release);
      card.on("pointerup", () => {
        release();
        if (this.suppressTap || this.modal) return;
        window.GamishAudio?.play("tap");
        action();
      });
    }

    createScrollIndicator() {
      const cx = WIDTH / 2;
      this.trackWidth = 220;
      this.add.rectangle(cx, 706, this.trackWidth, 4, 0xffffff, 0.08).setOrigin(0.5);
      this.thumb = this.add.rectangle(cx - this.trackWidth / 2, 706, 60, 4, COLORS.gold, 0.7).setOrigin(0, 0.5);
    }

    // ---------- Scrolling with momentum ----------

    measureScroll() {
      const viewWidth = visibleRight() - Math.max(visibleLeft(), 0);
      this.maxScroll = Math.max(0, this.contentRight - Math.max(visibleLeft(), 0) - viewWidth);
      this.scrollX = Phaser.Math.Clamp(this.scrollX, 0, this.maxScroll);
      const share = this.maxScroll ? viewWidth / (viewWidth + this.maxScroll) : 1;
      this.thumb.width = Math.max(36, this.trackWidth * share);
      this.thumb.setVisible(this.maxScroll > 0);
    }

    applyScroll() {
      this.content.x = -this.scrollX;
      if (this.maxScroll > 0) {
        const progress = Phaser.Math.Clamp(this.scrollX / this.maxScroll, 0, 1);
        this.thumb.x = WIDTH / 2 - this.trackWidth / 2 + progress * (this.trackWidth - this.thumb.width);
      }
    }

    setScroll(value, clamp = false) {
      this.scrollX = clamp ? Phaser.Math.Clamp(value, 0, this.maxScroll) : value;
      this.applyScroll();
    }

    glideTo(target) {
      this.velocity = 0;
      const to = Phaser.Math.Clamp(target, 0, this.maxScroll);
      this.tweens.add({ targets: this, scrollX: to, duration: 380, ease: "Cubic.Out", onUpdate: () => this.applyScroll() });
    }

    // Stage coordinates straight from the raw pointer: Phaser only refreshes pointer.worldX/Y
    // while hit-testing objects, which lags a fast swipe.
    stagePoint(pointer) {
      return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    }

    inCatalog(pointer) {
      const { y } = this.stagePoint(pointer);
      return y >= LOBBY.top - 20 && y <= LOBBY.bottom + 20;
    }

    onPointerDown(pointer) {
      if (this.modal || !this.inCatalog(pointer)) {
        this.drag = null;
        return;
      }
      this.tweens.killTweensOf(this);
      // Touching a gliding strip just catches it; that touch must not also open a game.
      this.suppressTap = Math.abs(this.velocity) > 0.08;
      this.velocity = 0;
      const { x } = this.stagePoint(pointer);
      this.drag = { x, start: this.scrollX, moved: false, samples: [{ x, t: pointer.downTime || performance.now() }] };
    }

    onPointerMove(pointer) {
      const drag = this.drag;
      if (!drag || !pointer.isDown) return;
      // Scroll moves the content, not the camera, so stage x is stable while dragging.
      const { x } = this.stagePoint(pointer);
      const dx = x - drag.x;
      if (!drag.moved && Math.abs(dx) > 10) {
        drag.moved = true;
        this.suppressTap = true;
        this.cards.forEach((card) => { if (card.scale !== 1) { this.tweens.killTweensOf(card); card.setScale(1); } });
      }
      if (!drag.moved) return;
      let target = drag.start - dx;
      // Rubber-band past either end instead of stopping dead.
      if (target < 0) target *= 0.35;
      else if (target > this.maxScroll) target = this.maxScroll + (target - this.maxScroll) * 0.35;
      this.setScroll(target);
      // Event timestamps, not processing time, so the fling speed matches the finger.
      const now = pointer.moveTime || performance.now();
      drag.samples.push({ x, t: now });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 110) drag.samples.shift();
    }

    onPointerUp(pointer) {
      const drag = this.drag;
      this.drag = null;
      if (!drag?.moved) return;
      const first = drag.samples[0];
      const last = drag.samples[drag.samples.length - 1];
      const elapsed = Math.max(1, last.t - first.t);
      this.velocity = Phaser.Math.Clamp(-(last.x - first.x) / elapsed, -4.5, 4.5);
      const liftedAt = pointer?.upTime || last.t;
      if (liftedAt - last.t > 100) this.velocity = 0; // the finger stopped before lifting: no fling
    }

    update(_time, delta) {
      if (this.drag?.moved || this.modal) return;
      const dt = Math.min(delta, 48);
      const outside = this.scrollX < 0 || this.scrollX > this.maxScroll;
      if (Math.abs(this.velocity) > 0.015) {
        this.scrollX += this.velocity * dt;
        this.velocity *= Math.pow(outside ? 0.7 : 0.955, dt / 16.7);
      } else {
        this.velocity = 0;
      }
      if (this.scrollX < 0) this.scrollX = this.scrollX > -0.5 ? 0 : this.scrollX * (1 - Math.min(1, dt * 0.014));
      else if (this.scrollX > this.maxScroll) {
        const over = this.scrollX - this.maxScroll;
        this.scrollX = over < 0.5 ? this.maxScroll : this.maxScroll + over * (1 - Math.min(1, dt * 0.014));
      }
      if (Math.abs(this.velocity) > 0 || outside) this.applyScroll();
    }

    // ---------- Navigation and dialogs ----------

    handleBack() {
      if (this.modal) this.closeModal();
      else this.glideTo(0);
    }

    openAppView(name) {
      window.dispatchEvent(new CustomEvent("gamish:navigate", { detail: name }));
    }

    // Module games open in the platform's game host (app.js), over the sleeping lobby.
    launchModule(entry) {
      window.GamishAudio?.play("tap");
      setStatus(`Opening ${entry.title}.`);
      window.dispatchEvent(new CustomEvent("gamish:play-module", { detail: entry }));
    }

    launchPhoenix() {
      if (this.leaving) return;
      this.leaving = true;
      window.GamishAudio?.play("flame-burst");
      this.cameras.main.fadeOut(260, 12, 4, 10);
      this.time.delayedCall(260, () => {
        this.leaving = false;
        this.scene.start("PhoenixGame");
      });
    }

    openDialog({ width, height, accent = COLORS.ember, build, actions }) {
      if (this.modal) return;
      this.velocity = 0;
      const modal = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(100);
      const blocker = this.add.rectangle(0, 0, WIDTH + BLEED * 2, HEIGHT + BLEED * 2, 0x060309, 0.84).setInteractive();
      blocker.on("pointerup", () => this.closeModal());
      const glow = this.add.circle(0, -height / 2 + 120, 170, accent, 0.12).setBlendMode(Phaser.BlendModes.ADD);
      const panel = addSoftPanel(this, 0, 0, width, height, { fill: 0x130b18, alpha: 0.98, radius: 40 });
      const shield = this.add.zone(0, 0, width, height).setInteractive(); // taps on the card don't close it
      modal.add([blocker, glow, panel, shield, ...build()]);
      const buttonWidth = Math.min(300, (width - 80 - (actions.length - 1) * 16) / actions.length);
      actions.forEach(({ label, primary, onTap }, index) => {
        const x = (index - (actions.length - 1) / 2) * (buttonWidth + 16);
        const button = this.add.container(x, height / 2 - 62);
        button.add([
          addSoftPanel(this, 0, 0, buttonWidth, 62, { fill: primary ? accent : 0x2a1828, alpha: primary ? 1 : 0.96, radius: 31 }),
          this.add.text(0, -1, label, { fontFamily: BODY_FONT, fontSize: "20px", fontStyle: "700", color: primary ? "#1d0b06" : "#fff0c0", letterSpacing: 1 }).setOrigin(0.5),
        ]);
        button.setSize(buttonWidth, 70).setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => pressFeedback(this, button, 0.95));
        button.on("pointerup", () => onTap());
        modal.add(button);
      });
      modal.setScale(0.94).setAlpha(0);
      this.tweens.add({ targets: modal, scale: 1, alpha: 1, duration: 200, ease: "Back.Out" });
      this.modal = { modal };
    }

    openProfile() {
      // The profile is a page (it has text fields for payment usernames), not a canvas dialog.
      this.openAppView("profile");
    }

    openGameModal(game) {
      setStatus(`${game.title} preview. This game isn't playable yet.`);
      this.openDialog({
        width: 760,
        height: 420,
        accent: game.accent,
        build: () => [
          (game.cover && this.textures.exists(game.cover) ? this.add.image(-210, -40, game.cover)
            : game.art ? this.add.image(-210, -40, "gamish-game-icons", game.art) : this.add.image(-210, -40, "phoenix")).setDisplaySize(230, 230),
          this.add.text(-60, -110, game.category.toUpperCase(), { fontFamily: BODY_FONT, fontSize: "15px", fontStyle: "700", color: "#c7a984", letterSpacing: 3 }).setOrigin(0, 0.5),
          this.add.text(-60, -60, game.title.toUpperCase(), { fontFamily: DISPLAY_FONT, fontSize: "30px", color: "#fff0c2", wordWrap: { width: 380 } }).setOrigin(0, 0.5),
          this.add.text(-60, 10, `Coming to Gamish777 soon.${PHOENIX.live ? `\n${PHOENIX.name} is ready to play now.` : ""}`, { fontFamily: BODY_FONT, fontSize: "19px", color: "#cbb8bf", lineSpacing: 8 }).setOrigin(0, 0.5),
        ],
        actions: [
          { label: "CLOSE", onTap: () => this.closeModal() },
          ...(PHOENIX.live ? [{ label: `PLAY ${PHOENIX.name.toUpperCase()}`, primary: true, onTap: () => { this.closeModal(); this.launchPhoenix(); } }] : []),
        ],
      });
    }

    closeModal() {
      if (!this.modal) return;
      const { modal } = this.modal;
      this.modal = null;
      this.suppressTap = true; // the closing tap must not fall through onto a game tile
      this.time.delayedCall(60, () => { this.suppressTap = false; });
      this.tweens.add({
        targets: modal, alpha: 0, scale: 0.96, duration: 150,
        onComplete: () => {
          destroyWithTweens(this, modal);
          setStatus(`Browsing ${this.category.name.toLowerCase()} on Gamish777.`);
        },
      });
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
    frameX: 768,
    frameY: 372,
    frameScaleX: 0.475,
    frameScaleY: 0.53,
    xs: [541, 768, 996],
    widths: [210, 204, 210],
    top: 185,
    bottom: 528,
    centerY: 357,
    pitch: 150,
    size: 142,
    minSpinMs: 850,
    stopGapMs: 300,
    quickGapMs: 80,
    speed: 2.6,
  };
  // Landscape columns: info on the left, controls on the right under the thumb.
  const SIDE = { left: 222, right: 1316, width: 360 };
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

      this.add.text(REEL.frameX, 700, "VIRTUAL CREDITS  •  NO CASH VALUE", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c4a486", letterSpacing: 3,
      }).setOrigin(0.5);
      addIconButton(this, SIDE.right + 150, 64, "payments", () => {
        window.dispatchEvent(new CustomEvent("gamish:navigate", { detail: "payments" }));
      }, { label: "Wallet" });
      addSoundButton(this, SIDE.right + 72, 64);

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
      const left = SIDE.left - SIDE.width / 2;
      const right = SIDE.left + SIDE.width / 2;
      addPill(this, SIDE.left, 186, SIDE.width, 104, { fillAlpha: 0.9, strokeAlpha: 0.55, bend: 30, anchors: true });
      this.add.rectangle(SIDE.left, 186, 2, 60, COLORS.gold, 0.28);

      this.add.text(left + 24, 156, "BALANCE  ↻", {
        fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      });
      this.creditText = this.add.text(left + 24, 176, "0", {
        fontFamily: DISPLAY_FONT, fontSize: "34px", color: "#fff0c0", stroke: "#4e1a0b", strokeThickness: 4,
      });
      const balanceZone = this.add.zone(SIDE.left - SIDE.width / 4, 186, SIDE.width / 2, 100).setInteractive({ useHandCursor: true });
      balanceZone.on("pointerup", () => this.refreshAccountWallet());

      this.add.text(right - 24, 156, "LAST WIN", {
        fontFamily: BODY_FONT, fontSize: "13px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      }).setOrigin(1, 0);
      this.winText = this.add.text(right - 24, 176, "0", {
        fontFamily: DISPLAY_FONT, fontSize: "34px", color: "#ffd66e", stroke: "#4e1a0b", strokeThickness: 4,
      }).setOrigin(1, 0);
    }

    createMachine() {
      this.aura = this.add.ellipse(REEL.frameX, REEL.centerY, 820, 560, this.theme.accent, 0.16)
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
      addGradient(this, rowLeft, REEL.top, rowWidth, 70, [[0, "rgba(7,3,10,0.85)"], [1, "rgba(7,3,10,0)"]], "reel-shade-top");
      addGradient(this, rowLeft, REEL.bottom - 70, rowWidth, 70, [[0, "rgba(7,3,10,0)"], [1, "rgba(7,3,10,0.85)"]], "reel-shade-bottom");

      this.winLine = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.drawWinLine(this.theme.accent);

      this.add.image(REEL.frameX, REEL.frameY, "phoenix-reel-frame-v3").setScale(REEL.frameScaleX, REEL.frameScaleY);

      this.resultText = this.add.text(REEL.frameX, 664, "", {
        fontFamily: BODY_FONT, fontSize: "17px", fontStyle: "700", color: "#ffe2a6", letterSpacing: 3,
        stroke: "#140710", strokeThickness: 4,
      }).setOrigin(0.5);
      this.setMessage("SWIPE DOWN TO SPIN", "#ffe2a6");

      const zone = this.add.zone(REEL.frameX, REEL.centerY, 660, REEL.bottom - REEL.top).setInteractive();
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
      const left = SIDE.left - SIDE.width / 2;
      this.collectionPanel = addPill(this, SIDE.left, 336, SIDE.width, 140, { fillAlpha: 0.9, strokeAlpha: 0.45, bend: 28 });
      this.collectionIcon = this.add.image(left + 58, 346, "phoenix-symbols-v2", "symbol-8").setDisplaySize(78, 78);
      this.tweens.add({ targets: this.collectionIcon, y: 340, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.add.text(left + 24, 282, "COLLECTION", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#e8b872", letterSpacing: 3,
      });
      this.collectionText = this.add.text(left + SIDE.width - 24, 282, "0 / 10", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#e8c792", letterSpacing: 2,
      }).setOrigin(1, 0);
      this.gems = Array.from({ length: COLLECTION_GOAL }, (_, index) => {
        const x = left + 132 + (index % 5) * 46;
        const y = 330 + Math.floor(index / 5) * 42;
        const socket = this.add.circle(x, y, 17, 0x2a1426, 0.95).setStrokeStyle(2, 0x6b3a4c, 0.8);
        const gem = this.add.image(x, y, "phoenix-symbols-v2", "symbol-1").setDisplaySize(36, 36).setAlpha(0);
        return { x, y, socket, gem };
      });
    }

    createControls() {
      // Bet stepper
      const cx = SIDE.right;
      addPill(this, cx, 182, 300, 100, { fillAlpha: 0.92, strokeAlpha: 0.5 });
      this.add.text(cx, 148, "BET", {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c9a987", letterSpacing: 4,
      }).setOrigin(0.5);
      this.betHome = { x: cx, y: 192 };
      this.betText = this.add.text(cx, 192, "10", {
        fontFamily: DISPLAY_FONT, fontSize: "32px", color: "#fff0c0",
      }).setOrigin(0.5);
      this.betDown = this.makeRoundButton(cx - 100, 192, 30, "−", () => this.stepBet(-1));
      this.betUp = this.makeRoundButton(cx + 100, 192, 30, "+", () => this.stepBet(1));

      // Auto spin
      this.autoPanel = addPill(this, cx, 590, 300, 100, { fillAlpha: 0.92, strokeAlpha: 0.5 });
      this.autoTitle = this.add.text(cx, 572, "AUTO", {
        fontFamily: DISPLAY_FONT, fontSize: "24px", color: "#fff0c0",
      }).setOrigin(0.5);
      this.autoSub = this.add.text(cx, 610, `${AUTO_SPINS} SPINS`, {
        fontFamily: BODY_FONT, fontSize: "12px", fontStyle: "700", color: "#c9a987", letterSpacing: 3,
      }).setOrigin(0.5);
      const autoZone = this.add.zone(cx, 590, 300, 100).setInteractive({ useHandCursor: true });
      autoZone.on("pointerdown", () => {
        pressFeedback(this, this.autoTitle, 0.9);
        pressFeedback(this, this.autoSub, 0.9);
      });
      autoZone.on("pointerup", () => this.toggleAuto());

      // Spin
      const spin = this.add.container(cx, 388);
      this.spinHalo = this.add.circle(0, 0, 124, this.theme.accent, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      const ringKey = "spin-ring-glow";
      if (!this.textures.exists(ringKey)) {
        const texture = this.textures.createCanvas(ringKey, 240, 240);
        const ctx = texture.getContext();
        const glow = ctx.createRadialGradient(120, 120, 96, 120, 120, 120);
        glow.addColorStop(0, "rgba(255, 200, 100, 0.55)");
        glow.addColorStop(0.35, "rgba(255, 150, 50, 0.28)");
        glow.addColorStop(1, "rgba(255, 120, 30, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(120, 120, 120, 0, Math.PI * 2);
        ctx.fill();
        texture.refresh();
      }
      this.spinRing = this.add.image(0, 0, ringKey);
      const rim = this.add.circle(0, 0, 101, 0xf0b552, 1);
      const disc = this.add.circle(0, 0, 97, 0x9b2014, 1);
      const inner = this.add.circle(0, -6, 84, 0xc2331b, 0.55);
      const shine = this.add.ellipse(0, -52, 110, 26, 0xffffff, 0.16);
      this.spinLabel = this.add.text(0, -8, "SPIN", {
        fontFamily: DISPLAY_FONT, fontSize: "36px", color: "#fff4d2", stroke: "#5e1206", strokeThickness: 6,
      }).setOrigin(0.5);
      this.spinSub = this.add.text(0, 34, "10 CR", {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#ffd9a0", letterSpacing: 3,
      }).setOrigin(0.5);
      spin.add([this.spinHalo, this.spinRing, rim, disc, inner, shine, this.spinLabel, this.spinSub]);
      spin.setSize(236, 236).setInteractive({ useHandCursor: true });
      spin.on("pointerdown", () => pressFeedback(this, spin));
      spin.on("pointerup", () => this.spin());
      this.spinButton = spin;
      this.tweens.add({ targets: this.spinHalo, scale: { from: 0.94, to: 1.1 }, alpha: { from: 0.12, to: 0.32 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.ringTween = this.tweens.add({ targets: this.spinRing, angle: 360, duration: 9000, repeat: -1 });
    }

    createPaytable() {
      const entries = [
        { x: SIDE.left - 92, frame: "symbol-1", label: "×1.5", color: "#ff7d8c" },
        { x: SIDE.left + 92, frame: "symbol-0", label: "×3", color: "#ffd66e" },
      ];
      entries.forEach(({ x, frame, label, color }) => {
        const chip = this.add.container(x, 482);
        const plate = addPill(this, 0, 0, 176, 74, { fillAlpha: 0.82, strokeAlpha: 0.32 });
        const icons = [-58, -32, -6].map((offset) => this.add.image(offset, 0, "phoenix-symbols-v2", frame).setDisplaySize(34, 34));
        const text = this.add.text(48, 0, label, {
          fontFamily: DISPLAY_FONT, fontSize: "24px", color, stroke: "#3b0d06", strokeThickness: 4,
        }).setOrigin(0.5);
        chip.add([plate, ...icons, text]);
        chip.setSize(176, 74).setInteractive({ useHandCursor: true });
        chip.on("pointerdown", () => pressFeedback(this, chip, 0.95));
        chip.on("pointerup", () => this.showRules());
      });
      this.add.text(SIDE.left - SIDE.width / 2 + 78, 572, "HOW TO WIN", {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#e8c792", letterSpacing: 3,
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showRules());
      const rules = this.add.container(SIDE.left - SIDE.width / 2 + 44, 572);
      const rulesHalo = this.add.circle(0, 0, 31, COLORS.ember, 0.12).setBlendMode(Phaser.BlendModes.ADD);
      const rulesPlate = this.add.circle(0, 0, 24, 0x3a1626, 0.96);
      const rulesIcon = this.add.text(0, -1, "?", {
        fontFamily: DISPLAY_FONT, fontSize: "25px", color: "#ffe0a0", stroke: "#52150c", strokeThickness: 3,
      }).setOrigin(0.5);
      rules.add([rulesHalo, rulesPlate, rulesIcon]).setSize(60, 60).setInteractive({ useHandCursor: true });
      rules.on("pointerup", () => this.showRules());
      this.tweens.add({ targets: rulesHalo, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.1, to: 0.3 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    makeRoundButton(x, y, radius, label, onClick) {
      const button = this.add.container(x, y);
      const disc = this.add.circle(0, 0, radius, 0x3a1626, 1);
      const shine = this.add.ellipse(0, -radius * 0.45, radius * 1.1, radius * 0.5, 0xffd9a0, 0.12);
      const text = this.add.text(0, -2, label, {
        fontFamily: BODY_FONT, fontSize: "30px", fontStyle: "700", color: "#ffe4a3",
      }).setOrigin(0.5);
      button.add([disc, shine, text]);
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
            x: this.creditText.x + 50,
            y: this.creditText.y + 22,
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
      const panel = addPill(this, 0, 110, 620, 320, { fill: 0x160911, fillAlpha: 0.97, strokeAlpha: 0.95, lineWidth: 4, bend: 48, anchors: true });
      const phoenix = this.add.image(0, -180, "phoenix-symbols-v2", "symbol-8").setDisplaySize(250, 250);
      const heading = this.add.text(0, 34, "BIG WIN", {
        fontFamily: DISPLAY_FONT, fontSize: "64px", color: "#fff0a8", stroke: "#8b1c08", strokeThickness: 10,
        shadow: { offsetY: 8, color: "#000000", blur: 18, fill: true },
      }).setOrigin(0.5);
      const amount = this.add.text(0, 116, "+0", {
        fontFamily: DISPLAY_FONT, fontSize: "58px", color: "#ffd461", stroke: "#6c1608", strokeThickness: 8,
      }).setOrigin(0.5);
      const caption = this.add.text(0, 176, `${multiplier}× YOUR BET  •  VIRTUAL CREDITS`, {
        fontFamily: BODY_FONT, fontSize: "14px", fontStyle: "700", color: "#f2c989", letterSpacing: 4,
      }).setOrigin(0.5);
      const hint = this.add.text(0, 226, "TAP TO COLLECT", {
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
      this.tweens.add({ targets: phoenix, y: -196, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
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
        this.betText.setPosition(this.betHome.x, this.betHome.y).setScale(1);
        this.tweens.add({ targets: this.betText, x: this.betHome.x + direction * 6, duration: 50, yoyo: true, repeat: 1 });
        return;
      }
      this.bet = next;
      window.GamishAudio?.play("chip");
      buzz(6);
      this.tweens.killTweensOf(this.betText);
      this.betText.setPosition(this.betHome.x, this.betHome.y);
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
      const panel = addPill(this, 0, 0, 760, 560, { fill: 0x120913, fillAlpha: 0.98, strokeAlpha: 0.85, lineWidth: 3, bend: 44, anchors: true });
      const title = this.add.text(0, -228, "HOW TO WIN", {
        fontFamily: DISPLAY_FONT, fontSize: "32px", color: "#fff0bd", stroke: "#52150c", strokeThickness: 6,
      }).setOrigin(0.5);
      const items = HOW_TO_PLAY.flatMap(([frame, heading, copy, color], index) => {
        const y = -128 + index * 112;
        return [
          this.add.image(-280, y, "phoenix-symbols-v2", frame).setDisplaySize(90, 90),
          this.add.text(-210, y - 30, heading, { fontFamily: BODY_FONT, fontSize: "18px", fontStyle: "700", color, letterSpacing: 2 }),
          this.add.text(-210, y + 2, copy, { fontFamily: BODY_FONT, fontSize: "16px", color: "#cdb8bd", lineSpacing: 4 }),
        ];
      });
      const tip = this.add.text(0, 196, "Swipe down on the reels to spin.  Tap the reels to stop them early.", {
        fontFamily: BODY_FONT, fontSize: "15px", color: "#b79da4", align: "center", lineSpacing: 6,
      }).setOrigin(0.5);
      const hint = this.add.text(0, 238, "TAP ANYWHERE TO CLOSE", {
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

    handleBack() {
      if (this.overlay) this.overlay.close();
      else this.returnToHall();
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
      // No multisampled WebGL buffer: it quadruples framebuffer memory, which iOS punishes.
      // Art is drawn from textures and the canvas renders near native resolution, so edges stay smooth.
      antialiasGL: false,
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
      // No pointer smoothing: drags track the finger 1:1 instead of trailing behind it.
      smoothFactor: 0,
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
    const renderWidth = () => Math.round(VIEW.width * VIEW.zoom);
    const renderHeight = () => Math.round(VIEW.height * VIEW.zoom);
    config.width = renderWidth();
    config.height = renderHeight();
    config.scale.width = renderWidth();
    config.scale.height = renderHeight();

    // Text is rasterised at the render zoom so it stays crisp when the camera scales it up.
    const textFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
    Phaser.GameObjects.GameObjectFactory.prototype.text = function text(x, y, value, style = {}) {
      return textFactory.call(this, x, y, value, { resolution: Math.max(1, VIEW.zoom), ...style });
    };

    const game = new Phaser.Game(config);
    window.addEventListener("gamish:signedout", () => game.scene.start("WaitForPlayer"));
    // The phone's back button, routed here by app.js, steps back inside the game.
    window.addEventListener("gamish:back", () => {
      const scene = game.scene.getScenes(true)[0];
      scene?.handleBack?.();
    });

    let resizeTimer;
    const refit = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = measureView();
        if (["width", "height", "left", "top", "zoom"].every((key) => next[key] === VIEW[key])) return;
        Object.assign(VIEW, next);
        game.scale.setGameSize(renderWidth(), renderHeight());
        game.scene.getScenes(true).forEach((scene) => {
          applyView(scene);
          scene.events.emit("viewchange");
        });
      }, 120);
    };
    window.addEventListener("resize", refit);
    window.visualViewport?.addEventListener("resize", refit);
    window.addEventListener("orientationchange", refit);

    // Stop drawing while the wallet or messages page, or the rotate prompt, covers the game;
    // resume where it left off.
    let currentView = "arcade";
    const syncLoop = () => {
      if (currentView === "arcade" && !PORTRAIT_PROMPT.matches) game.loop.wake();
      else game.loop.sleep();
    };
    window.addEventListener("gamish:view", (event) => {
      currentView = event.detail;
      syncLoop();
    });
    PORTRAIT_PROMPT.addEventListener?.("change", () => {
      syncLoop();
      refit();
    });
    // Phaser starts its loop after "ready", so apply the sleep state once the first frame has run.
    game.events.once("poststep", syncLoop);
  };

  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
})();
