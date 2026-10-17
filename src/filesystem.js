import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const viteClient = path.join(path.dirname(require.resolve('vite/package.json')), 'dist/client');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

// Vite's safeModulePaths and static symlinks can bypass server.fs.allow alone.
export function captureFilesystem(roots) {
  const allowed = file => roots.some(root => inside(root, file)) || inside(viteClient, file);
  const checked = async file => {
    const actual = await realpath(file).catch(error => {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    });
    return !actual || allowed(actual);
  };
  return {
    name: 'animlang-filesystem-boundary', enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0];
      if (path.isAbsolute(file) && !await checked(file)) throw new Error('The import is outside the allowed asset directories.');
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
          if (pathname.startsWith('/__')) {
            res.statusCode = 403;
            res.end('Development server control endpoints are disabled during capture.');
            return;
          }
          // Vite 8 injects its client even with HMR/WS disabled. Capture needs
          // CSS updates, but no live-reload socket, overlay, or server RPC.
          if (pathname === '/@vite/client') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(`const styles = new Map();
              export function updateStyle(id, text) {
                let style = styles.get(id);
                if (!style) { style = document.createElement('style'); document.head.append(style); styles.set(id, style); }
                style.textContent = text;
              }
              export function removeStyle(id) { styles.get(id)?.remove(); styles.delete(id); }
              export function createHotContext() {
                const noop = () => {};
                return { data: {}, accept: noop, acceptExports: noop, dispose: noop,
                  prune: noop, invalidate: noop, on: noop, off: noop, send: noop };
              }
            `);
            return;
          }
          const candidates = pathname.startsWith('/@fs/') ? [pathname.slice('/@fs/'.length)]
            : [path.join(server.config.root, pathname), path.join(server.config.publicDir, pathname)];
          for (const file of candidates) {
            if (!await checked(file)) {
              res.statusCode = 403;
              res.end('The file is outside the allowed asset directories.');
              return;
            }
          }
          next();
        } catch {
          res.statusCode = 403;
          res.end('The asset path is not permitted.');
        }
      });
    },
  };
}
