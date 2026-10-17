import { constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { openBrowserScene } from './browser.js';
import { renderManim } from './manim.js';
import { clipVideo, encodeFrames, extractFrame, ffmpeg, ffprobe, frameName, probeVideo } from './media.js';
import { exists, inspectTimes, loadProject, renderRange, writeJson } from './project.js';
import { requireValue } from './errors.js';
import { run } from './process.js';

export async function inspectProject(directory, options = {}) {
  const project = await loadProject(directory);
  const source = project.engine === 'manim' ? await renderManim(project, options) : await openBrowserScene(project, options);
  let output;
  let successful = false;
  try {
    const times = inspectTimes(options.at, source.duration);
    const parent = path.join(project.root, 'output');
    await mkdir(parent, { recursive: true });
    output = await mkdtemp(path.join(parent, 'inspect-'));
    const frames = [];
    for (const [index, time] of times.entries()) {
      const file = path.join(output, frameName(index));
      // A video has no frame at duration. Select its final encoded frame instead.
      const actualTime = project.engine === 'manim'
        ? Math.min(Math.floor((time + 1e-9) * source.fps), (source.frames ?? Math.round(source.duration * source.fps)) - 1) / source.fps
        : time;
      if (project.engine === 'manim') await extractFrame(source.file, actualTime, file);
      else await source.capture(time, file);
      frames.push({ time, actualTime, file });
    }
    const result = { command: 'inspect', project: project.root, engine: project.engine,
      width: project.width, height: project.height, fps: project.fps, duration: source.duration, directory: output, frames };
    await writeJson(path.join(output, 'result.json'), result);
    successful = true;
    return result;
  } finally {
    try { await source.close(); }
    finally { if (!successful && output) await rm(output, { recursive: true, force: true }); }
  }
}

export async function renderProject(directory, options = {}) {
  const project = await loadProject(directory);
  const parent = options.output ? path.dirname(path.resolve(options.output)) : path.join(project.root, 'output');
  if (options.output) {
    requireValue(path.extname(options.output).toLowerCase() === '.mp4', 'INVALID_OUTPUT', 'Use an .mp4 output file.');
    requireValue(!await exists(path.resolve(options.output)), 'FILE_EXISTS', `The output file already exists: ${options.output}`);
  }
  await mkdir(parent, { recursive: true });
  // Fail before a long capture if the encoder is not installed.
  await run(ffmpeg(), ['-version'], { timeout: 10000 });
  await run(ffprobe(), ['-version'], { timeout: 10000 });
  const temporary = await mkdtemp(path.join(parent, '.animlang-'));
  let source;
  try {
    source = project.engine === 'manim' ? await renderManim(project, options) : await openBrowserScene(project, options);
    const range = renderRange(options, source.duration, project.fps);
    const video = path.join(temporary, 'render.mp4');
    if (project.engine === 'manim') {
      if (range.from === 0 && range.to === source.duration) await copyFile(source.file, video, constants.COPYFILE_EXCL);
      else await clipVideo(source.file, range, project.fps, video);
    } else {
      for (let frame = 0; frame < range.frames; frame++) {
        await source.capture(range.from + frame / project.fps, path.join(temporary, frameName(frame)));
      }
      await source.close();
      source = undefined;
      await encodeFrames(temporary, project.fps, range.frames, video);
    }
    const metadata = await probeVideo(video);
    const file = options.output ? path.resolve(options.output) : path.join(parent, `render-${path.basename(temporary).slice('.animlang-'.length)}.mp4`);
    await copyFile(video, file, constants.COPYFILE_EXCL);
    return { command: 'render', project: project.root, engine: project.engine, file, from: range.from, to: range.to, ...metadata };
  } finally {
    try { await source?.close(); }
    finally { await rm(temporary, { recursive: true, force: true }); }
  }
}

export async function doctor() {
  const checks = [];
  for (const [name, executable] of [['ffmpeg', ffmpeg()], ['ffprobe', ffprobe()]]) {
    try {
      const result = await run(executable, ['-version'], { timeout: 10000 });
      checks.push({ name, ok: true, version: result.stdout.split('\n')[0] });
    } catch (error) { checks.push({ name, ok: false, error: error.message }); }
  }
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.ANIMLANG_CHROMIUM_PATH });
    checks.push({ name: 'chromium', ok: true, version: browser.version() });
  } catch (error) { checks.push({ name: 'chromium', ok: false, error: 'Run npx playwright install chromium, or set ANIMLANG_CHROMIUM_PATH.', details: error.message }); }
  finally { await browser?.close(); }
  return { command: 'doctor', ok: checks.every(check => check.ok), checks };
}
