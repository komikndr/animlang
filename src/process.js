import { spawn } from 'node:child_process';
import { AnimlangError } from './errors.js';

// Keep the end of verbose renderer logs without buffering the full output.
export function run(command, args, { cwd, env, timeout = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = timeout ? setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout) : undefined;
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-65536); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-65536); });
    child.on('error', error => {
      clearTimeout(timer);
      reject(new AnimlangError('DEPENDENCY_MISSING', `Cannot start ${command}.`, { cause: error.message }));
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      if (status === 0) resolve({ stdout, stderr });
      else reject(new AnimlangError(timedOut ? 'PROCESS_TIMEOUT' : 'PROCESS_FAILED',
        `${command} did not finish successfully.`, { status, signal, stdout, stderr }));
    });
  });
}
