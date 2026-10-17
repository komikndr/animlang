import { spawn } from 'node:child_process';
import { AnimlangError } from './errors.js';

// Keep the end of verbose renderer logs without buffering the full output.
export function run(command, args, { cwd, env, timeout = 0, signal } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(command, args, {
      cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const kill = () => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    const abort = () => kill();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = timeout ? setTimeout(() => {
      timedOut = true;
      kill();
    }, timeout) : undefined;
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-65536); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-65536); });
    child.on('error', error => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new AnimlangError('DEPENDENCY_MISSING', `Cannot start ${command}.`, { cause: error.message }));
    });
    child.on('close', (status, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) reject(signal.reason);
      else if (status === 0) resolve({ stdout, stderr });
      else reject(new AnimlangError(timedOut ? 'PROCESS_TIMEOUT' : 'PROCESS_FAILED',
        `${command} did not finish successfully.`, { status, signal: exitSignal, stdout, stderr }));
    });
  });
}
