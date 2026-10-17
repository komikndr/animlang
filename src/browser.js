import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
import { AnimlangError, requireValue } from './errors.js';

export async function openBrowserScene(project, options = {}) {
  const timeout = Number(options.timeout ?? 30000);
  requireValue(Number.isSafeInteger(timeout) && timeout > 0, 'INVALID_TIMEOUT', 'Set timeout to a positive number of milliseconds.');
  const server = await createServer({
    root: project.root, configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, watch: null },
    optimizeDeps: { entries: [project.entry] },
  });
  let browser;
  const diagnostics = [];
  let rejectScene;
  const failedScene = new Promise((_, reject) => { rejectScene = reject; });
  // Errors can arrive between awaited operations. Keep the rejection handled.
  failedScene.catch(() => {});
  const record = message => {
    if (diagnostics.length < 20) diagnostics.push(message);
    rejectScene(new AnimlangError('SCENE_ERROR', 'The browser scene reported an error.', diagnostics));
  };
  const guard = task => Promise.race([task, failedScene]);
  const healthy = () => {
    if (diagnostics.length) throw new AnimlangError('SCENE_ERROR', 'The browser scene reported an error.', diagnostics);
  };
  const close = async () => {
    try { await browser?.close(); }
    finally { await server.close(); }
  };
  try {
    await server.listen();
    try {
      browser = await chromium.launch({
        executablePath: options.browser ?? process.env.ANIMLANG_CHROMIUM_PATH,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
    } catch (error) {
      throw new AnimlangError('BROWSER_UNAVAILABLE',
        'Cannot start Chromium. Run npx playwright install chromium, or set ANIMLANG_CHROMIUM_PATH.', { cause: error.message });
    }
    const page = await browser.newPage({
      viewport: { width: project.width, height: project.height }, deviceScaleFactor: 1,
      locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark',
    });
    page.setDefaultTimeout(timeout);
    page.on('pageerror', error => record(error.message));
    page.on('console', message => { if (message.type() === 'error') record(message.text()); });
    page.on('requestfailed', request => record(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
        record(`${response.status()} ${response.url()}`);
      }
    });
    await page.addInitScript(() => { window.__ANIMLANG_CAPTURE__ = true; });
    const address = server.httpServer.address();
    const url = new URL(`http://127.0.0.1:${address.port}`);
    url.pathname = path.relative(project.root, project.entry).split(path.sep).map(encodeURIComponent).join('/');
    await guard(page.goto(url.href, { waitUntil: 'load', timeout }));
    await guard(page.waitForFunction(() => window.animlang || window.READY === true, null, { timeout }));
    const duration = await guard(page.evaluate(async timeoutMs => {
      let timer;
      try {
        return await Promise.race([
          (async () => {
            const scene = window.animlang;
            if (scene) {
              if (typeof scene.seek !== 'function') throw new Error('window.animlang.seek must be a function.');
              await scene.ready;
            } else if (typeof window.seekFrame !== 'function' || typeof window.ANIM_DURATION !== 'function') {
              throw new Error('The legacy scene needs seekFrame(t) and ANIM_DURATION().');
            }
            await document.fonts.ready;
            await Promise.all([...document.images].map(image => image.decode()));
            return scene ? scene.duration : window.ANIM_DURATION();
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scene readiness timed out.')), timeoutMs); }),
        ]);
      } finally { clearTimeout(timer); }
    }, timeout));
    requireValue(Number.isFinite(duration) && duration > 0, 'INVALID_DURATION', 'The scene duration must be a positive number of seconds.');
    healthy();
    return {
      duration,
      async capture(time, file) {
        try {
          await guard(page.evaluate(async ({ time, timeoutMs }) => {
            let timer;
            try {
              await Promise.race([
                Promise.resolve().then(() => window.animlang ? window.animlang.seek(time) : window.seekFrame(time)),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scene seek timed out.')), timeoutMs); }),
              ]);
            } finally { clearTimeout(timer); }
          }, { time, timeoutMs: timeout }));
          healthy();
          await guard(page.screenshot({ path: file, type: 'png', timeout }));
          healthy();
        } catch (error) {
          if (error instanceof AnimlangError) throw error;
          throw new AnimlangError('SCENE_ERROR', `Cannot capture the scene at ${time} seconds.`, { cause: error.message, diagnostics });
        }
      },
      close,
    };
  } catch (error) {
    await close();
    if (error instanceof AnimlangError) throw error;
    throw new AnimlangError('SCENE_ERROR', 'Cannot prepare or capture the browser scene.', { cause: error.message, diagnostics });
  }
}
