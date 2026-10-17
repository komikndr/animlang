import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from './process.js';
import { exists } from './project.js';
import { probeVideo } from './media.js';
import { AnimlangError, requireValue } from './errors.js';

export async function pythonFor(root, override) {
  if (override ?? process.env.ANIMLANG_PYTHON) return override ?? process.env.ANIMLANG_PYTHON;
  const local = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return await exists(local) ? local : process.platform === 'win32' ? 'python' : 'python3';
}

async function findMovie(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'partial_movie_files') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await findMovie(file));
    else if (entry.name === 'animlang.mp4') result.push(file);
  }
  return result;
}

export async function renderManim(project, options = {}) {
  const python = await pythonFor(project.root, options.python);
  try { await run(python, ['-m', 'manim', '--version'], { cwd: project.root, timeout: 30000 }); }
  catch (error) {
    throw new AnimlangError('MANIM_UNAVAILABLE',
      'Cannot run Manim. Install requirements.txt in a project .venv, or select Python with --python.', { cause: error.message, details: error.details });
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'animlang-manim-'));
  const close = () => rm(temporary, { recursive: true, force: true });
  try {
    await run(python, ['-m', 'manim', 'render', '--renderer', 'cairo', '--format', 'mp4',
      '--disable_caching', '--progress_bar', 'none', '--verbosity', 'WARNING',
      '--resolution', `${project.width},${project.height}`, '--fps', String(project.fps),
      '--media_dir', temporary, '--output_file', 'animlang', project.entry, project.scene],
    { cwd: project.root, env: { PYTHONDONTWRITEBYTECODE: '1' } });
    const movies = await findMovie(temporary);
    requireValue(movies.length === 1, 'MANIM_OUTPUT_MISSING', 'Manim did not produce exactly one animlang.mp4 file.');
    const metadata = await probeVideo(movies[0]);
    requireValue(metadata.width === project.width && metadata.height === project.height && Math.abs(metadata.fps - project.fps) < 0.001,
      'MANIM_CONFIG_MISMATCH', 'The Manim scene changed the configured dimensions or frame rate.');
    return { file: movies[0], ...metadata, close };
  } catch (error) { await close(); throw error; }
}
