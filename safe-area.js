(() => {
  "use strict";

  // In landscape iOS reports the notch's safe margin on BOTH sides, although the notch sits on
  // one side only. Honouring both wastes ~60px a side, so keep the full margin on the notch side
  // and a small one on the other. Android already reports the cutout side alone.
  const QUIET_SIDE = 12;

  const readEnv = () => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const value = (side) => parseFloat(style[`padding${side}`]) || 0;
    const insets = { top: value("Top"), right: value("Right"), bottom: value("Bottom"), left: value("Left") };
    probe.remove();
    return insets;
  };

  // 90: the phone's top (and notch) is on the left; 270: on the right.
  const rotation = () => {
    const legacy = typeof window.orientation === "number" ? window.orientation : null;
    const angle = legacy ?? window.screen?.orientation?.angle ?? 0;
    return ((angle % 360) + 360) % 360;
  };

  const read = () => {
    if (!document.body) return { top: 0, right: 0, bottom: 0, left: 0 };
    const insets = readEnv();
    const symmetric = insets.left > 0 && Math.abs(insets.left - insets.right) < 1;
    if (symmetric && window.innerWidth > window.innerHeight) {
      const turn = rotation();
      if (turn === 90) insets.right = Math.min(insets.right, QUIET_SIDE);
      else if (turn === 270) insets.left = Math.min(insets.left, QUIET_SIDE);
    }
    return insets;
  };

  const apply = () => {
    const insets = read();
    const root = document.documentElement.style;
    root.setProperty("--edge-top", `${insets.top}px`);
    root.setProperty("--edge-right", `${insets.right}px`);
    root.setProperty("--edge-bottom", `${insets.bottom}px`);
    root.setProperty("--edge-left", `${insets.left}px`);
  };

  window.GamishSafeArea = { read };
  let timer;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 60);
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.screen?.orientation?.addEventListener?.("change", schedule);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
