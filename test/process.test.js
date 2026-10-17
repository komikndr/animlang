import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/process.js';

test('native process cancellation preserves the host deadline error', async () => {
  const controller = new AbortController();
  const reason = new Error('Host deadline expired');
  const timer = setTimeout(() => controller.abort(reason), 100);
  try {
    await assert.rejects(run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      signal: controller.signal,
    }), error => error === reason);
  } finally { clearTimeout(timer); }
});

test('native process timeout terminates the renderer', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    timeout: 100,
  }), error => error.code === 'PROCESS_TIMEOUT');
});
