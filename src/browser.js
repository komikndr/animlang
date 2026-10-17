import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { AnimlangError, requireValue } from './errors.js';
import { checkProjectLimits } from './limits.js';
import { captureFilesystem } from './filesystem.js';

export async function openBrowserScene(project, options = {}) {
  const timeout = Number(options.timeout ?? 30000);
  requireValue(Number.isSafeInteger(timeout) && timeout > 0, 'INVALID_TIMEOUT', 'Set timeout to a positive number of milliseconds.');
  requireValue(timeout <= 2147483647, 'INVALID_TIMEOUT', 'Set timeout to at most 2147483647 milliseconds.');
  checkProjectLimits(project);
  options.signal?.throwIfAborted();
  const allowedDirectories = [await realpath(project.root)];
  for (const directory of options.allowDirectory ?? []) {
    const resolved = await realpath(path.resolve(directory));
    requireValue((await stat(resolved)).isDirectory(), 'INVALID_DIRECTORY', `Not a directory: ${directory}`);
    allowedDirectories.push(resolved);
  }
  const allowedOrigins = new Set((options.allowOrigin ?? []).map(value => {
    let url;
    try { url = new URL(value); } catch { /* Report a structured error below. */ }
    requireValue(url && ['http:', 'https:'].includes(url.protocol) && url.href === `${url.origin}/`,
      'INVALID_ORIGIN', 'Use an HTTP or HTTPS origin without a path, query, or credentials.');
    return url.origin;
  }));
  const server = await createServer({
    root: project.root, configFile: false, envFile: false, envPrefix: [], logLevel: 'silent',
    // An inline object prevents postcss-load-config from executing project or parent configuration.
    css: { postcss: { plugins: [] } },
    plugins: [captureFilesystem(allowedDirectories)],
    server: { host: '127.0.0.1', port: 0, watch: null, hmr: false, ws: false, cors: false,
      fs: { strict: true, allow: allowedDirectories } },
    // No background dependency scan can read imports outside the file boundary.
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  let browser;
  let browserServer;
  const diagnostics = [];
  let rejectScene;
  const failedScene = new Promise((_, reject) => { rejectScene = reject; });
  // Errors can arrive between awaited operations. Keep the rejection handled.
  failedScene.catch(() => {});
  const record = message => {
    if (diagnostics.length < 20) diagnostics.push(message);
    rejectScene(new AnimlangError('SCENE_ERROR', 'The browser scene reported an error.', diagnostics));
  };
  let abort;
  const interrupted = new Promise((_, reject) => {
    abort = () => {
      reject(options.signal.reason);
      void browserServer?.kill();
    };
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
  });
  interrupted.catch(() => {});
  const guard = async task => {
    let timer;
    try {
      return await Promise.race([task, failedScene, interrupted, new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new AnimlangError('SCENE_ERROR', 'The browser operation exceeded its host-side timeout.'));
          void browserServer?.kill();
        }, timeout);
      })]);
    } finally { clearTimeout(timer); }
  };
  const healthy = () => {
    if (diagnostics.length) throw new AnimlangError('SCENE_ERROR', 'The browser scene reported an error.', diagnostics);
  };
  const close = async () => {
    options.signal?.removeEventListener('abort', abort);
    try { await browserServer?.kill(); }
    finally { await server.close(); }
  };
  try {
    await guard(server.listen());
    try {
      browserServer = await chromium.launchServer({
        executablePath: options.browser ?? process.env.ANIMLANG_CHROMIUM_PATH,
        chromiumSandbox: true,
        timeout,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
      options.signal?.throwIfAborted();
      browser = await guard(chromium.connect(browserServer.wsEndpoint(), { timeout }));
    } catch (error) {
      throw new AnimlangError('BROWSER_UNAVAILABLE',
        'Cannot start sandboxed Chromium. Install Chromium and enable its OS sandbox. Run animlang doctor for details.', { cause: error.message });
    }
    const context = await browser.newContext({
      viewport: { width: project.width, height: project.height }, deviceScaleFactor: 1,
      locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark',
      serviceWorkers: 'block', acceptDownloads: false,
    });
    const address = server.httpServer.address();
    const url = new URL(`http://127.0.0.1:${address.port}`);
    allowedOrigins.add(url.origin);
    await context.route('**/*', async route => {
      let response;
      try {
        const request = new URL(route.request().url());
        if (!allowedOrigins.has(request.origin) || !['http:', 'https:'].includes(request.protocol)) {
          record(`Blocked network request: ${request.origin}`);
          await route.abort('blockedbyclient');
          return;
        }
        // Playwright's continue() only intercepts the first hop of redirects.
        // Fetch without following them; use final asset URLs during capture.
        response = await route.fetch({ maxRedirects: 0, timeout });
        if (response.status() >= 300 && response.status() < 400 && response.headers().location) {
          record('Blocked HTTP redirect. Use the final asset URL and allow its origin explicitly.');
          await route.abort('blockedbyclient');
        } else await route.fulfill({ response });
      } catch (error) {
        record(`Cannot load a capture asset: ${error.message}`);
        await route.abort('failed').catch(() => {});
      } finally {
        await response?.dispose().catch(() => {});
      }
    });
    // WebSocket traffic does not pass through HTTP routing.
    await context.routeWebSocket('**/*', socket => {
      record(`Blocked WebSocket: ${new URL(socket.url()).origin}`);
      socket.close();
    });
    const page = await context.newPage();
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
