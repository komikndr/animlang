import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { openBrowserScene } from '../../src/browser.js';
import { inspectProject, renderProject } from '../../src/commands.js';
import { initProject, loadProject, packageRoot } from '../../src/project.js';

async function fixture(t) {
  const parent = path.join(packageRoot, '.test-output');
  await mkdir(parent, { recursive: true });
  const container = await mkdtemp(path.join(parent, 'security-'));
  t.after(() => rm(container, { recursive: true, force: true }));
  const root = path.join(container, 'scene');
  await initProject(root, 'gsap');
  await writeFile(path.join(root, 'animlang.json'), JSON.stringify({ engine: 'gsap', entry: 'index.html', width: 320, height: 180, fps: 6 }));
  const html = body => writeFile(path.join(root, 'index.html'), `<!doctype html><head><link rel="icon" href="data:,"></head><body>${body}</body>`);
  const contract = '<script>window.animlang={duration:1,seek(){document.body.dataset.time="ready"}}</script>';
  return { root, container, html, contract, project: await loadProject(root) };
}

test('capture never executes project or parent PostCSS/Vite configuration', { timeout: 30000 }, async t => {
  const { root, container, html, contract, project } = await fixture(t);
  const marker = path.join(container, 'CONFIG_EXECUTED');
  const malicious = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); module.exports={};`;
  for (const directory of [container, root]) {
    for (const file of ['postcss.config.cjs', 'vite.config.cjs']) await writeFile(path.join(directory, file), malicious);
  }
  await writeFile(path.join(root, 'style.css'), 'body { background: black; }');
  await html(`<link rel="stylesheet" href="style.css">${contract}`);
  const scene = await openBrowserScene(project);
  try { await scene.capture(0, path.join(container, 'frame.png')); }
  finally { await scene.close(); }
  assert.ok(!(await readdir(container)).includes('CONFIG_EXECUTED'));
});

test('external HTTP, redirects, and WebSockets are blocked; HTTP origins require an explicit opt-in', { timeout: 30000 }, async t => {
  const { root, html, contract, project } = await fixture(t);
  let hits = 0;
  let forbiddenHits = 0;
  const forbidden = createServer((req, res) => { forbiddenHits++; res.end('must not be reached'); });
  await new Promise(resolve => forbidden.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => forbidden.close(resolve)));
  const remote = createServer((req, res) => {
    hits++;
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/redirect') { res.writeHead(302, { Location: `http://127.0.0.1:${forbidden.address().port}/forbidden` }); res.end(); }
    else res.end('asset');
  });
  await new Promise(resolve => remote.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => remote.close(resolve)));
  const origin = `http://127.0.0.1:${remote.address().port}`;
  await html(`${contract}<script>fetch('${origin}/asset').catch(()=>{})</script>`);
  await assert.rejects(openBrowserScene(project), { code: 'SCENE_ERROR' });
  assert.equal(hits, 0);
  await html(`<script>window.animlang={duration:1,ready:fetch('${origin}/asset'),seek(){}}</script>`);
  const scene = await openBrowserScene(project, { allowOrigin: [origin] });
  await scene.close();
  assert.equal(hits, 1);
  await html(`<script>window.animlang={duration:1,ready:fetch('${origin}/redirect'),seek(){}}</script>`);
  await assert.rejects(openBrowserScene(project, { allowOrigin: [origin] }), { code: 'SCENE_ERROR' });
  assert.equal(forbiddenHits, 0, 'redirect targets must pass through the origin allowlist');
  await html(`${contract}<script>new WebSocket('ws://127.0.0.1:${remote.address().port}/socket')</script>`);
  await assert.rejects(openBrowserScene(project), { code: 'SCENE_ERROR' });
  assert.equal(hits, 2, 'the WebSocket must not reach the remote server');
  await assert.rejects(openBrowserScene(project, { allowOrigin: [`${origin}/asset`] }), { code: 'INVALID_ORIGIN' });
  assert.ok((await readdir(root)).includes('index.html'));
});

test('outside imports, raw reads, and public symlinks cannot escape the project', { timeout: 30000 }, async t => {
  const { root, container, html, contract, project } = await fixture(t);
  const external = path.join(container, 'private');
  await mkdir(external);
  const asset = path.join(external, 'asset.js');
  await writeFile(asset, 'export const privateValue = "private";');
  await mkdir(path.join(root, 'public'));
  await symlink(asset, path.join(root, 'public', 'linked.js'));
  for (const body of [
    `${contract}<script>window.animlang.ready=fetch('/@fs/${asset}').then(r=>{if(!r.ok)throw Error('blocked')})</script>`,
    `<script type="module">import value from '../private/asset.js?raw';window.animlang={duration:1,seek(){document.body.textContent=value}}</script>`,
    `<script type="module">import {privateValue} from '../private/asset.js';window.animlang={duration:1,seek(){document.body.textContent=privateValue}}</script>`,
    `<script type="module">import {privateValue} from '/linked.js';window.animlang={duration:1,seek(){document.body.textContent=privateValue}}</script>`,
  ]) {
    await html(body);
    await assert.rejects(openBrowserScene(project, { timeout: 3000 }), { code: 'SCENE_ERROR' });
  }
  await html(`<script type="module">import {privateValue} from '../private/asset.js';window.animlang={duration:1,seek(){document.body.textContent=privateValue}}</script>`);
  const scene = await openBrowserScene(project, { allowDirectory: [external] });
  try { await scene.capture(0, path.join(container, 'allowed.png')); }
  finally { await scene.close(); }
});

test('host-side deadlines stop synchronous infinite loops during readiness and seeking', { timeout: 20000 }, async t => {
  const { root, html } = await fixture(t);
  for (const code of [
    'window.animlang={duration:1,ready:new Promise(()=>{while(true){}}),seek(){}}',
    'window.animlang={duration:1,seek(){while(true){}}}',
  ]) {
    await html(`<script>${code}</script>`);
    const start = Date.now();
    await assert.rejects(inspectProject(root, { at: [0], timeout: 1000 }), { code: 'SCENE_ERROR' });
    assert.ok(Date.now() - start < 7000, 'the host timeout must not depend on the page event loop');
  }
  assert.deepEqual(await readdir(path.join(root, 'output')), []);
  await html('<script>window.animlang={duration:1,seek(){return new Promise(()=>{})}}</script>');
  await assert.rejects(renderProject(root, { jobTimeout: 1500, timeout: 10000 }), { code: 'JOB_TIMEOUT' });
  assert.deepEqual(await readdir(path.join(root, 'output')), []);
});

test('frame, dimension, and temporary output limits reject excess work and clean up', { timeout: 30000 }, async t => {
  const { root, html, contract } = await fixture(t);
  await html(contract);
  await assert.rejects(renderProject(root, { maxFrames: 1 }), { code: 'RESOURCE_LIMIT' });
  await assert.rejects(inspectProject(root, { at: [0], maxTempMb: 0.0000019073486328125 }), { code: 'RESOURCE_LIMIT' });
  assert.deepEqual(await readdir(path.join(root, 'output')), []);
  await writeFile(path.join(root, 'animlang.json'), JSON.stringify({ engine: 'gsap', entry: 'index.html', width: 8192, height: 8192, fps: 6 }));
  await assert.rejects(inspectProject(root), { code: 'RESOURCE_LIMIT' });
});
