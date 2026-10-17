// Both examples use absolute scene time. The CLI disables only the preview loop.
export function publishScene(duration, seek) {
  const ready = document.fonts.ready;
  window.animlang = { duration, ready, seek };
  seek(0);
  if (!window.__ANIMLANG_CAPTURE__) ready.then(() => {
    const fixed = new URLSearchParams(location.search).get('t');
    if (fixed !== null) return seek(Math.max(0, Math.min(Number(fixed), duration)));
    const start = performance.now();
    const tick = time => {
      seek(((time - start) / 1000) % duration);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
