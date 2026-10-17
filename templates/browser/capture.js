// Keep this interface small. The scene owns all timeline and renderer logic.
export function publishScene({ duration, seek, ready = document.fonts.ready }) {
  const draw = seconds => seek(Math.max(0, Math.min(seconds, duration)));
  window.animlang = { duration, seek: draw, ready };
  draw(0);

  // Normal browser visits play the scene. CLI capture uses only explicit seeks.
  if (!window.__ANIMLANG_CAPTURE__) {
    ready.then(() => {
      const fixedTime = new URLSearchParams(location.search).get('t');
      if (fixedTime !== null) return draw(Number(fixedTime));
      const start = performance.now();
      const frame = now => {
        draw(((now - start) / 1000) % duration);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
}
