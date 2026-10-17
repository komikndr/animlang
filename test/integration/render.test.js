import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { inspectProject, renderProject } from '../../src/commands.js';
import { initProject, loadProject, packageRoot } from '../../src/project.js';
import { openBrowserScene } from '../../src/browser.js';
import { run } from '../../src/process.js';

async function fixture(t, template) {
  const parent = path.join(packageRoot, '.test-output');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, `${template} scene `));
  if (!process.env.ANIMLANG_KEEP_TEST_OUTPUT) t.after(() => rm(root, { recursive: true, force: true }));
  await initProject(root, template);
  const file = path.join(root, 'animlang.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...config, width: 640, height: 360, fps: 6 }));
  return root;
}

async function hash(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

for (const template of ['gsap', 'three', 'vanta']) {
  test(`${template}: random-access PNGs and a real H.264 export`, { timeout: 120000 }, async t => {
    const root = await fixture(t, template);
    await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, timeout: 60000 });
    const result = await inspectProject(root, { at: [0, 2, 5.5, 2, 0] });
    assert.equal(result.duration, 6);
    assert.equal(await hash(result.frames[0].file), await hash(result.frames[4].file), 'seeking back to zero must reset the scene');
    assert.equal(await hash(result.frames[1].file), await hash(result.frames[3].file), 'a repeated timestamp must match');
    assert.notEqual(await hash(result.frames[0].file), await hash(result.frames[2].file), 'animation must change the visible frame');
    const png = await readFile(result.frames[1].file);
    assert.equal(png.readUInt32BE(16), 640);
    assert.equal(png.readUInt32BE(20), 360);
    const independent = await inspectProject(root, { at: [2] });
    assert.equal(await hash(result.frames[1].file), await hash(independent.frames[0].file), 'fresh capture must match a seek through other times');

    const video = await renderProject(root, { from: '1', to: '2' });
    assert.equal(video.width, 640);
    assert.equal(video.height, 360);
    assert.equal(video.fps, 6);
    assert.equal(video.frames, 6);
    assert.equal(video.duration, 1);
    await assert.rejects(renderProject(root, { output: video.file }), { code: 'FILE_EXISTS' });
    assert.ok(!(await readdir(path.dirname(video.file))).some(name => name.startsWith('.animlang-')), 'temporary frames must be removed');
  });
}

test('legacy seekFrame bridge waits for assets and supports asynchronous seeks', { timeout: 30000 }, async t => {
  const root = await fixture(t, 'gsap');
  await writeFile(path.join(root, 'index.html'), `<!doctype html><html><head><link rel="icon" href="data:,"></head><body>
    <div id="label"></div><script>
    window.ANIM_DURATION = () => 2;
    window.seekFrame = async seconds => {
      await new Promise(resolve => setTimeout(resolve, 10));
      document.querySelector('#label').textContent = seconds;
    };
    document.fonts.ready.then(() => { window.READY = true; });
    </script></body></html>`);
  const result = await inspectProject(root, { at: [1, 0, 1] });
  assert.equal(result.duration, 2);
  assert.equal(await hash(result.frames[0].file), await hash(result.frames[2].file));
});

test('scene readiness errors, invalid durations, and failed asset requests stop capture', { timeout: 30000 }, async t => {
  const root = await fixture(t, 'gsap');
  for (const [body, code] of [
    ['<script>window.animlang={duration:0,seek(){}}</script>', 'INVALID_DURATION'],
    ['<script>window.animlang={duration:1,ready:Promise.reject(new Error("asset failed")),seek(){}}</script>', 'SCENE_ERROR'],
    ['<img src="missing.png"><script>window.animlang={duration:1,seek(){}}</script>', 'SCENE_ERROR'],
    ['<script>window.animlang={duration:1,ready:new Promise(()=>{}),seek(){}}</script>', 'SCENE_ERROR'],
  ]) {
    await writeFile(path.join(root, 'index.html'), `<!doctype html><html><head><link rel="icon" href="data:,"></head><body>${body}</body></html>`);
    await assert.rejects(openBrowserScene(await loadProject(root), { timeout: 1000 }), { code });
  }
});

test('a rejected or stalled seek reports a scene error and removes incomplete output', { timeout: 30000 }, async t => {
  const root = await fixture(t, 'gsap');
  for (const code of ['throw new Error("cannot draw")', 'return new Promise(()=>{})']) {
    await writeFile(path.join(root, 'index.html'), `<!doctype html><html><head><link rel="icon" href="data:,"></head><body>
      <script>window.animlang={duration:1,seek(){${code}}}</script></body></html>`);
    await assert.rejects(inspectProject(root, { at: [0], timeout: 1000 }), { code: 'SCENE_ERROR' });
    assert.deepEqual(await readdir(path.join(root, 'output')), []);
    await assert.rejects(renderProject(root, { to: 0.5, timeout: 1000 }), { code: 'SCENE_ERROR' });
    assert.deepEqual(await readdir(path.join(root, 'output')), []);
  }
});

test('original GSAP prototypes work through the legacy bridge without source edits', {
  skip: !process.env.ANIMLANG_PROTOTYPE_PATH,
  timeout: 120000,
}, async t => {
  const root = await fixture(t, 'gsap');
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, timeout: 60000 });
  for (const entry of ['index.html', 'architecture.html']) {
    await copyFile(path.join(process.env.ANIMLANG_PROTOTYPE_PATH, entry), path.join(root, entry));
    await writeFile(path.join(root, 'animlang.json'), JSON.stringify({ engine: 'gsap', entry, width: 1920, height: 1080, fps: 6 }));
    const result = await inspectProject(root, { at: [10, 0, 10] });
    // The prototype's CSS filters can round individual color channels differently after reverse seeks.
    // Keep a tight visual tolerance: 90 dB means less than 0.009 channel levels RMS.
    const comparison = await run('ffmpeg', ['-hide_banner', '-nostdin', '-i', result.frames[0].file,
      '-i', result.frames[2].file, '-lavfi', 'psnr', '-f', 'null', '-']);
    const psnr = comparison.stderr.match(/average:([\d.]+|inf)/)?.[1];
    assert.ok(psnr === 'inf' || Number(psnr) >= 90, `prototype frames must match visually (PSNR: ${psnr})`);
    const video = await renderProject(root, { from: 10, to: 11 });
    assert.equal(video.width, 1920);
    assert.equal(video.height, 1080);
    assert.equal(video.frames, 6);
  }
});

test('Manim: inspect endpoint frames, export the full video, and export a range', {
  skip: !process.env.ANIMLANG_TEST_PYTHON,
  timeout: 120000,
}, async t => {
  const root = await fixture(t, 'manim');
  const options = { python: process.env.ANIMLANG_TEST_PYTHON };
  const result = await inspectProject(root, { ...options, at: [0, 2, 6] });
  assert.equal(result.duration, 6);
  assert.equal(result.frames[2].actualTime, 35 / 6);
  assert.notEqual(await hash(result.frames[0].file), await hash(result.frames[1].file));
  const video = await renderProject(root, options);
  assert.equal(video.width, 640);
  assert.equal(video.height, 360);
  assert.equal(video.fps, 6);
  assert.equal(video.duration, 6);
  assert.equal(video.frames, 36);
  const clip = await renderProject(root, { ...options, from: '1', to: '2' });
  assert.equal(clip.frames, 6);
  assert.equal(clip.duration, 1);
});
