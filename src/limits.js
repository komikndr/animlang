import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { AnimlangError, requireValue } from './errors.js';

export function captureLimits(options = {}) {
  const limits = {
    jobTimeout: Number(options.jobTimeout ?? 1800000),
    maxFrames: Number(options.maxFrames ?? 18000),
    maxTempBytes: Number(options.maxTempMb ?? 2048) * 1024 * 1024,
  };
  for (const [name, value] of Object.entries(limits)) {
    requireValue(Number.isSafeInteger(value) && value > 0, 'INVALID_LIMIT', `Set ${name} to a positive integer.`);
  }
  requireValue(limits.jobTimeout <= 2147483647, 'INVALID_LIMIT', 'Set jobTimeout to at most 2147483647 milliseconds.');
  return limits;
}

export function checkProjectLimits(project) {
  requireValue(project.width <= 4096 && project.height <= 4096 && project.width * project.height <= 3840 * 2160,
    'RESOURCE_LIMIT', 'Use dimensions of at most 4096 per side and 8294400 total pixels.');
  requireValue(project.fps <= 120, 'RESOURCE_LIMIT', 'Use at most 120 frames per second.');
}

export function checkFrameLimit(frames, options) {
  requireValue(Number.isSafeInteger(frames) && frames > 0 && frames <= captureLimits(options).maxFrames,
    'RESOURCE_LIMIT', `The capture exceeds the frame limit (${captureLimits(options).maxFrames}).`);
}

// The controller lives in Node, not in the scene's JavaScript event loop.
export function startJob(options = {}) {
  const controller = new AbortController();
  const limits = captureLimits(options);
  const timer = setTimeout(() => controller.abort(new AnimlangError('JOB_TIMEOUT', 'The capture exceeded its overall deadline.')), limits.jobTimeout);
  return { options: { ...options, signal: controller.signal }, close: () => clearTimeout(timer) };
}

async function directoryBytes(directory, maximum) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    // Do not follow links that scene code can create in a temporary directory.
    const info = await lstat(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (!info || info.isSymbolicLink()) continue;
    bytes += info.isDirectory() ? await directoryBytes(file, maximum - bytes) : info.size;
    if (bytes > maximum) break;
  }
  return bytes;
}

export function watchTemporary(directory, options = {}) {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const maximum = captureLimits(options).maxTempBytes;
  let running;
  const check = async () => {
    signal.throwIfAborted();
    requireValue(await directoryBytes(directory, maximum) <= maximum,
      'RESOURCE_LIMIT', 'The capture exceeded its temporary output limit.');
  };
  const timer = setInterval(() => {
    if (running) return;
    running = check().catch(error => controller.abort(error)).finally(() => { running = undefined; });
  }, 250);
  return { options: { ...options, signal }, check, async close() { clearInterval(timer); await running; } };
}
