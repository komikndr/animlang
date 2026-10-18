import { constants } from 'node:fs';
import { access, copyFile, cp, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnimlangError, requireValue } from './errors.js';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const templates = ['gsap', 'three', 'vanta', 'manim'];

export async function exists(file) {
  try { await access(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

async function copyTemplateContents(source, target) {
  // Copy entries rather than the existing root directory. Node 22.22+
  // rejects an existing destination directory with errorOnExist enabled.
  for (const entry of await readdir(source)) {
    await cp(path.join(source, entry), path.join(target, entry), {
      recursive: true, force: false, errorOnExist: true,
    });
  }
}

export async function initProject(directory, template) {
  requireValue(templates.includes(template), 'INVALID_TEMPLATE', `Choose a template: ${templates.join(', ')}.`);
  const root = path.resolve(directory);
  if (await exists(root)) {
    requireValue((await readdir(root)).filter(name => name !== '.git').length === 0,
      'DIRECTORY_NOT_EMPTY', `The project directory is not empty: ${root}`);
  }
  await mkdir(root, { recursive: true });
  if (template !== 'manim') {
    await copyTemplateContents(path.join(packageRoot, 'templates/browser'), root);
  }
  await copyTemplateContents(path.join(packageRoot, 'templates', template), root);
  await writeFile(path.join(root, '.gitignore'), 'node_modules/\noutput/\n.venv/\n__pycache__/\nmedia/\n', { flag: 'wx' });
  return {
    command: 'init', project: root, template,
    next: template === 'manim'
      ? ['uv venv', 'uv pip install -r requirements.txt', 'animlang inspect .']
      : ['npm install', 'animlang inspect .', 'animlang render .'],
  };
}

export async function loadProject(directory = '.') {
  const root = await realpath(path.resolve(directory));
  const file = path.join(root, 'animlang.json');
  let config;
  try { config = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new AnimlangError('INVALID_CONFIG', `Cannot read ${file}.`, { cause: error.message }); }
  requireValue(config && typeof config === 'object' && !Array.isArray(config), 'INVALID_CONFIG', 'The configuration must be a JSON object.');
  const allowed = ['engine', 'entry', 'width', 'height', 'fps', 'scene'];
  for (const key of Object.keys(config)) {
    requireValue(allowed.includes(key), 'INVALID_CONFIG', `Unknown configuration key: ${key}`);
  }
  requireValue(['gsap', 'three', 'manim'].includes(config.engine), 'INVALID_CONFIG', 'Set engine to gsap, three, or manim.');
  requireValue(typeof config.entry === 'string' && config.entry.length > 0 && !path.isAbsolute(config.entry),
    'INVALID_CONFIG', 'Set entry to a project-relative file path.');
  for (const key of ['width', 'height']) {
    requireValue(Number.isSafeInteger(config[key]) && config[key] > 0 && config[key] % 2 === 0,
      'INVALID_CONFIG', `Set ${key} to a positive, even integer for H.264 export.`);
  }
  requireValue(Number.isSafeInteger(config.fps) && config.fps > 0, 'INVALID_CONFIG', 'Set fps to a positive integer.');
  if (config.engine === 'manim') {
    requireValue(typeof config.scene === 'string' && /^[A-Za-z_]\w*$/.test(config.scene),
      'INVALID_CONFIG', 'Set scene to a Python Scene class name.');
  }
  const entry = await realpath(path.resolve(root, config.entry)).catch(error => {
    throw new AnimlangError('ENTRY_MISSING', `Cannot read the scene entry: ${config.entry}`, { cause: error.message });
  });
  const relative = path.relative(root, entry);
  requireValue(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'INVALID_CONFIG', 'The scene entry must stay inside the project directory.');
  requireValue((await stat(entry)).isFile(), 'INVALID_CONFIG', 'The scene entry must be a file.');
  return { ...config, root, entry };
}

export function parseTimes(value) {
  const parts = value.split(',').map(part => part.trim());
  const times = parts.map(Number);
  requireValue(parts.every(Boolean) && times.every(t => Number.isFinite(t) && t >= 0),
    'INVALID_TIME', 'Use non-negative seconds separated by commas, such as --at 0,1.5,3.');
  return times;
}

export function inspectTimes(times, duration) {
  const result = times ?? [0, duration / 2, duration];
  requireValue(result.every(t => t <= duration), 'INVALID_TIME', `Frame times must be between 0 and ${duration} seconds.`);
  return result;
}

export function renderRange(options, duration, fps) {
  const from = options.from === undefined ? 0 : Number(options.from);
  const to = options.to === undefined ? duration : Number(options.to);
  requireValue(Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to <= duration && from < to,
    'INVALID_TIME', `Use a render range with 0 <= from < to <= ${duration}.`);
  return { from, to, frames: Math.ceil(Number(((to - from) * fps).toFixed(9))) };
}

export async function setupSkill(directory, harness, force = false) {
  const folders = { opencode: '.opencode', claude: '.claude', agents: '.agents' };
  requireValue(Object.hasOwn(folders, harness), 'INVALID_HARNESS', 'Choose opencode, claude, or agents.');
  const root = path.resolve(directory);
  const source = path.join(packageRoot, 'skills/animlang/SKILL.md');
  const target = path.join(root, folders[harness], 'skills/animlang/SKILL.md');
  if (await exists(target)) {
    if (await readFile(target, 'utf8') === await readFile(source, 'utf8')) {
      return { command: 'setup', file: target, status: 'current' };
    }
    requireValue(force, 'FILE_EXISTS', `The skill already exists: ${target}. Use --force to replace it.`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target, force ? 0 : constants.COPYFILE_EXCL);
  return { command: 'setup', file: target, status: 'installed', next: 'Restart the agent harness to load the skill.' };
}
