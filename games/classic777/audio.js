// Classic 777 — sound and music, all synthesised with Web Audio (no audio files to load).
// Nothing plays until the player taps: unlock() must be called from a tap or key press.
window.Classic777Audio = (() => {
  "use strict";

  const MODES = ["all", "sfx", "off"]; // music + effects → effects only → muted
  let mode = "all";
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let reverb = null;
  let noiseBuffer = null;
  let tickTimer = null;
  let rumble = null;
  let musicTimer = null;
  let nextBeat = 0;
  let beat = 0;
  let iosKick = null;

  const MUSIC_LEVEL = 0.16;
  const SFX_LEVEL = 0.9;

  // ---------- setup ----------
  function impulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
    return buffer;
  }

  // A short silent WAV played through an <audio> element moves iOS into the "playback"
  // audio session, so Web Audio is heard even with the ringer switch on silent.
  function silentWavUrl() {
    const samples = 800;
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE");
    text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, samples * 2, true);
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = mode === "off" ? 0 : 1;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(2.2, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    reverb.connect(wet).connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = mode === "all" ? MUSIC_LEVEL : 0;
    const musicTone = ctx.createBiquadFilter();
    musicTone.type = "lowpass";
    musicTone.frequency.value = 5200;
    musicBus.connect(musicTone).connect(master);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (mode !== "off") ctx.resume();
    });
    return true;
  }

  // ---------- voices ----------
  // One oscillator with an envelope. `to` = output bus, `send` = reverb amount.
  function tone(freq, dur, o = {}) {
    if (!ctx || mode === "off") return;
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + (o.slideTime || dur));
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.2;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.005));
    if (o.hold) amp.gain.setValueAtTime(peak, t + (o.attack || 0.005) + o.hold);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(o.lowpass, t);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      f.Q.value = o.q || 0.8;
      node = osc.connect(f);
    }
    node.connect(amp).connect(o.to || sfxBus);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; amp.connect(s).connect(reverb); }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (!ctx || mode === "off") return;
    const t = ctx.currentTime + (o.when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter || "bandpass";
    filter.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.sweep) filter.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    filter.Q.value = o.q || 1;
    const amp = ctx.createGain();
    const peak = o.gain ?? 0.15;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.004));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(amp).connect(o.to || sfxBus);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; amp.connect(s).connect(reverb); }
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // A metallic coin "ting": inharmonic partials with a fast decay.
  function coin(when = 0, pitch = 1, gain = 0.08) {
    const base = 2350 * pitch;
    [1, 2.76, 5.4].forEach((ratio, i) => tone(base * ratio, 0.35 - i * 0.08, { when, gain: gain / (i + 1), send: 0.4 }));
  }

  // Brass-like stab for fanfares.
  function brass(freq, when, dur, gain = 0.07) {
    [-8, 0, 8].forEach((detune) => tone(freq, dur, {
      type: "sawtooth", when, gain, detune, attack: 0.03, hold: dur * 0.5, lowpass: 900, sweep: 2600, send: 0.35,
    }));
  }

  // ---------- background music: a slow casino-lounge loop ----------
  const BPM = 96;
  const STEP = 60 / BPM / 2; // eighth notes
  const CHORDS = [ // Cmaj7, Am7, Dm7, G7 (Hz)
    { bass: 65.41, notes: [261.63, 329.63, 392.0, 493.88] },
    { bass: 55.0, notes: [220.0, 261.63, 329.63, 392.0] },
    { bass: 73.42, notes: [293.66, 349.23, 440.0, 523.25] },
    { bass: 49.0, notes: [246.94, 293.66, 349.23, 392.0] },
  ];
  const MELODY = [ // one bar per chord, 8 eighth-note slots (0 = rest)
    [783.99, 0, 659.25, 0, 587.33, 659.25, 0, 0],
    [523.25, 0, 0, 587.33, 659.25, 0, 523.25, 0],
    [587.33, 0, 698.46, 0, 659.25, 0, 587.33, 523.25],
    [587.33, 0, 0, 0, 493.88, 0, 392.0, 0],
  ];

  function keys(freq, when, dur, gain) { // soft electric piano
    tone(freq, dur, { to: musicBus, when, gain, type: "sine", attack: 0.008, send: 0.3 });
    tone(freq * 2, dur * 0.5, { to: musicBus, when, gain: gain * 0.25, type: "triangle", attack: 0.004 });
  }

  function scheduleStep(when) {
    const bar = Math.floor(beat / 8) % CHORDS.length;
    const slot = beat % 8;
    const chord = CHORDS[bar];
    const at = when - ctx.currentTime;
    // walking bass on the beat
    if (slot % 2 === 0) {
      const walk = [1, 1.5, 1.25, 1.5][slot / 2];
      tone(chord.bass * walk, STEP * 1.8, { to: musicBus, when: at, gain: 0.5, type: "triangle", lowpass: 420 });
    }
    // chord comp on 1 and the "and" of 2
    if (slot === 0 || slot === 3) chord.notes.forEach((f) => keys(f, at + Math.random() * 0.012, STEP * 3, 0.07));
    // melody, every other time round the loop
    const phrase = Math.floor(beat / 32) % 2;
    const note = MELODY[bar][slot];
    if (phrase === 1 && note) keys(note, at, STEP * 2.2, 0.11);
    // brushed shaker
    noise(0.05, { to: musicBus, when: at, gain: slot % 2 ? 0.05 : 0.09, filter: "highpass", freq: 7000 });
    // soft kick on 1 and 3
    if (slot === 0 || slot === 4) tone(110, 0.2, { to: musicBus, when: at, gain: 0.35, slide: 0.4, slideTime: 0.12 });
    beat += 1;
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    nextBeat = ctx.currentTime + 0.15;
    musicTimer = setInterval(() => {
      if (mode !== "all") { nextBeat = ctx.currentTime + 0.1; return; }
      while (nextBeat < ctx.currentTime + 0.25) { scheduleStep(nextBeat); nextBeat += STEP; }
    }, 60);
  }

  function setMusicLevel(level, seconds = 0.4) {
    if (!ctx) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(level, now + seconds);
  }

  function duck(seconds) { // lower the music under a big win
    if (!ctx || mode !== "all") return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL * 0.2, now + 0.15);
    musicBus.gain.setValueAtTime(MUSIC_LEVEL * 0.2, now + seconds);
    musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, now + seconds + 1.2);
  }

  function applyMode() {
    if (!ctx) return;
    master.gain.setTargetAtTime(mode === "off" ? 0 : 1, ctx.currentTime, 0.05);
    setMusicLevel(mode === "all" ? MUSIC_LEVEL : 0);
    if (mode === "off") { ctx.suspend(); } else { ctx.resume(); }
  }

  // ---------- public ----------
  return {
    get mode() { return mode; },

    // Call from a tap/keypress. Creates the audio graph the first time.
    unlock() {
      if (!ctx && !build()) return;
      if (!iosKick) {
        iosKick = new Audio(silentWavUrl());
        iosKick.setAttribute("playsinline", "");
        iosKick.play().catch(() => {});
      }
      if (mode !== "off" && ctx.state !== "running") ctx.resume();
      startMusic();
    },

    cycle() {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      applyMode();
      return mode;
    },

    // Follow the platform's sound switch (its game bar): "all" or "off".
    setMode(next) {
      if (!MODES.includes(next) || next === mode) return mode;
      mode = next;
      applyMode();
      return mode;
    },

    click(pitch = 1) {
      tone(1500 * pitch, 0.05, { type: "triangle", gain: 0.09 });
      tone(3000 * pitch, 0.02, { gain: 0.03 });
    },

    lever() {
      noise(0.12, { gain: 0.35, freq: 650, q: 2 });
      tone(180, 0.18, { type: "square", gain: 0.06, slide: 0.5, lowpass: 900 });
      noise(0.45, { gain: 0.12, freq: 600, sweep: 3500, when: 0.05, filter: "bandpass", attack: 0.2, send: 0.2 });
      coin(0.04, 0.8, 0.04);
    },

    startSpin() {
      this.stopSpin();
      if (!ctx || mode === "off") return;
      // mechanical clicks of the reel stops passing the pawl
      tickTimer = setInterval(() => {
        tone(820 + Math.random() * 160, 0.025, { type: "square", gain: 0.022, lowpass: 2500 });
      }, 68);
      // low motor rumble
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.25);
      src.connect(f).connect(g).connect(sfxBus);
      src.start();
      rumble = { src, g };
    },

    stopSpin() {
      clearInterval(tickTimer);
      tickTimer = null;
      if (rumble && ctx) {
        const { src, g } = rumble;
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value || 0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        src.stop(ctx.currentTime + 0.25);
      }
      rumble = null;
    },

    // `matching` = how many reels so far show the same symbol on the line (1–5)
    reelStop(index, matching = 1) {
      tone(140 - index * 10, 0.22, { gain: 0.45, slide: 0.45, slideTime: 0.1 });
      noise(0.06, { gain: 0.25, freq: 2200, q: 1.5 });
      tone(420, 0.06, { type: "square", gain: 0.03, lowpass: 1200 });
      if (matching >= 2) {
        const f = matching === 2 ? 880 : 1174.66;
        tone(f, 0.5, { type: "triangle", gain: 0.1, send: 0.5 });
        tone(f * 1.5, 0.4, { gain: 0.05, send: 0.5, when: 0.03 });
      }
    },

    tease() {
      tone(330, 0.9, { type: "sawtooth", gain: 0.05, slide: 2.2, lowpass: 700, sweep: 3000, send: 0.4, attack: 0.1 });
      noise(0.9, { gain: 0.06, freq: 900, sweep: 6000, attack: 0.5 });
      for (let i = 0; i < 6; i++) tone(1200 + i * 120, 0.05, { type: "square", gain: 0.02, when: i * 0.12 });
    },

    lose() {
      tone(392, 0.16, { type: "triangle", gain: 0.07, send: 0.2 });
      tone(311.13, 0.28, { type: "triangle", gain: 0.06, when: 0.12, send: 0.2 });
    },

    // level 1 = small win, 2 = big (10×+), 3 = mega (20×+), 4 = jackpot (five 7s)
    win(level) {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
      const count = Math.min(notes.length, 3 + level);
      notes.slice(0, count).forEach((f, i) => {
        tone(f, 0.35, { type: "triangle", gain: 0.13, when: i * 0.075, send: 0.4 });
        tone(f * 2, 0.15, { gain: 0.04, when: i * 0.075 });
      });
      const coins = level === 1 ? 6 : 14 + level * 10;
      for (let i = 0; i < coins; i++) coin(0.25 + i * (level === 1 ? 0.07 : 0.055) + Math.random() * 0.03, 0.85 + Math.random() * 0.4);
      if (level >= 2) {
        duck(level === 4 ? 4.5 : 3);
        const at = count * 0.075 + 0.05;
        const fanfare = level === 4
          ? [[392, 0, 0.18], [523.25, 0.2, 0.18], [659.25, 0.4, 0.18], [783.99, 0.6, 0.7], [659.25, 1.35, 0.18], [783.99, 1.55, 1.3]]
          : [[523.25, 0, 0.16], [659.25, 0.18, 0.16], [783.99, 0.36, 0.9]];
        fanfare.forEach(([f, t, d]) => { brass(f, at + t, d); brass(f / 2, at + t, d, 0.04); });
        if (level >= 3) {
          const end = at + (level === 4 ? 1.55 : 0.36);
          [261.63, 329.63, 392.0, 523.25].forEach((f) => brass(f, end, 1.6, 0.035));
          tone(65.41, 2, { gain: 0.25, when: end, attack: 0.02, send: 0.4 });
          noise(1.5, { gain: 0.08, freq: 6000, filter: "highpass", when: end, attack: 0.02, send: 0.6 });
        }
      }
    },

    countTick(progress) {
      tone(900 + progress * 900, 0.04, { type: "triangle", gain: 0.04 });
    },

    error() {
      tone(196, 0.22, { type: "square", gain: 0.05, lowpass: 900 });
      tone(185, 0.22, { type: "square", gain: 0.05, lowpass: 900, when: 0.16 });
    },
  };
})();
