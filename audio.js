(() => {
  "use strict";

  const STORAGE_KEY = "gamish777-sound";
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context;
  let master;
  let enabled = true;

  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabled = true;
  }

  const ensureContext = () => {
    if (!enabled || !AudioContextClass) return null;
    if (!context) {
      context = new AudioContextClass();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master = context.createGain();
      master.gain.value = 0.62;
      master.connect(compressor);
      compressor.connect(context.destination);
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  };

  const tone = (frequency, duration, options = {}) => {
    const audio = ensureContext();
    if (!audio || !master) return;
    const start = audio.currentTime + (options.delay ?? 0);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to ?? frequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.035, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };

  const sequence = (notes, options = {}) => {
    notes.forEach((note, index) => {
      const frequency = Array.isArray(note) ? note[0] : note;
      const delay = Array.isArray(note) ? note[1] : index * (options.step ?? 0.075);
      tone(frequency, options.duration ?? 0.13, {
        delay,
        gain: options.gain ?? 0.032,
        type: options.type ?? "triangle",
        to: frequency * (options.glide ?? 1.01),
      });
    });
  };

  const play = (name) => {
    if (!enabled) return;
    switch (name) {
      case "tap":
        tone(480, 0.055, { to: 650, type: "triangle", gain: 0.022 });
        break;
      case "nav":
        sequence([[430, 0], [650, 0.055]], { duration: 0.09, gain: 0.026 });
        break;
      case "spin":
        sequence([[180, 0], [235, 0.065], [320, 0.13], [440, 0.195]], { duration: 0.11, gain: 0.03, glide: 1.12 });
        break;
      case "tick":
        tone(920, 0.038, { to: 610, type: "square", gain: 0.012 });
        break;
      case "win-small":
        sequence([[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.29]], { duration: 0.22, gain: 0.045, glide: 1.02 });
        break;
      case "win-big":
        sequence([[392, 0], [523.25, 0.07], [659.25, 0.14], [783.99, 0.23], [1046.5, 0.34], [1318.5, 0.46]], { duration: 0.3, gain: 0.05, glide: 1.025 });
        sequence([[196, 0.02], [261.63, 0.16], [329.63, 0.3]], { duration: 0.42, gain: 0.022, type: "sine" });
        break;
      case "lose":
        tone(230, 0.2, { to: 145, type: "triangle", gain: 0.025 });
        break;
      case "payment":
        sequence([[740, 0], [987.77, 0.075], [1318.5, 0.16]], { duration: 0.16, gain: 0.035, type: "sine", glide: 1.025 });
        break;
      case "message":
        sequence([[659.25, 0], [880, 0.075]], { duration: 0.12, gain: 0.028, glide: 1.025 });
        break;
      case "reply":
        sequence([[880, 0], [659.25, 0.08]], { duration: 0.13, gain: 0.024 });
        break;
      case "reset":
        sequence([[300, 0], [450, 0.065], [600, 0.13]], { duration: 0.12, gain: 0.028 });
        break;
      case "enabled":
        sequence([[523.25, 0], [783.99, 0.08], [1046.5, 0.16]], { duration: 0.14, gain: 0.03 });
        break;
      default:
        tone(540, 0.06, { to: 620, type: "triangle", gain: 0.02 });
    }
  };

  const setEnabled = (nextEnabled) => {
    enabled = Boolean(nextEnabled);
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Audio remains available for this page even if storage is unavailable.
    }
    if (enabled) {
      ensureContext();
      play("enabled");
    } else if (context?.state === "running") {
      context.suspend().catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("gamish:soundchange", { detail: enabled }));
    return enabled;
  };

  window.GamishAudio = {
    isEnabled: () => enabled,
    contextState: () => context?.state ?? "not-started",
    play,
    setEnabled,
    toggle: () => setEnabled(!enabled),
  };
})();
