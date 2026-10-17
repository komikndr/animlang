import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initProject, inspectTimes, loadProject, parseTimes, renderRange, setupSkill } from '../src/project.js';
import { run } from '../src/process.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'animlang-unit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('initialization preserves an existing file and refuses unknown templates', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'user.txt'), 'keep me');
  await assert.rejects(initProject(root, 'gsap'), { code: 'DIRECTORY_NOT_EMPTY' });
  assert.equal(await readFile(path.join(root, 'user.txt'), 'utf8'), 'keep me');
  await assert.rejects(initProject(path.join(root, 'new'), 'unknown'), { code: 'INVALID_TEMPLATE' });
});

test('configuration rejects invalid values and entry paths outside the project', async t => {
  const root = await fixture(t);
  const project = path.join(root, 'scene with spaces');
  await initProject(project, 'gsap');
  const configFile = path.join(project, 'animlang.json');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  const valid = await loadProject(project);
  assert.equal(valid.entry, path.join(project, 'index.html'));
  for (const override of [{ width: 321 }, { height: 0 }, { fps: 0 }, { fps: 1.5 }, { engine: 'vanta' }, { surprise: true }]) {
    await writeFile(configFile, JSON.stringify({ ...config, ...override }));
    await assert.rejects(loadProject(project), { code: 'INVALID_CONFIG' });
  }
  await writeFile(path.join(root, 'outside.html'), 'outside');
  await symlink(path.join(root, 'outside.html'), path.join(project, 'link.html'));
  for (const entry of ['../outside.html', 'link.html']) {
    await writeFile(configFile, JSON.stringify({ ...config, entry }));
    await assert.rejects(loadProject(project), { code: 'INVALID_CONFIG' });
  }
});

test('timestamps preserve reverse order and reject empty or invalid values', () => {
  assert.deepEqual(parseTimes('2, 0,2'), [2, 0, 2]);
  for (const input of ['', '1,', ',2', '-1', 'Infinity', 'NaN']) {
    assert.throws(() => parseTimes(input), { code: 'INVALID_TIME' });
  }
  assert.deepEqual(inspectTimes(undefined, 6), [0, 3, 6]);
  assert.throws(() => inspectTimes([7], 6), { code: 'INVALID_TIME' });
  assert.deepEqual(renderRange({ from: '0.1', to: '0.4' }, 6, 30), { from: 0.1, to: 0.4, frames: 9 });
  assert.equal(renderRange({ to: '0.35' }, 6, 30).frames, 11);
  for (const input of [{ from: 2, to: 1 }, { to: 7 }, { from: -1 }, { from: 'x' }]) {
    assert.throws(() => renderRange(input, 6, 30), { code: 'INVALID_TIME' });
  }
});

test('skill setup is idempotent and preserves an edited skill', async t => {
  const root = await fixture(t);
  const first = await setupSkill(root, 'opencode');
  assert.equal(first.status, 'installed');
  assert.equal((await setupSkill(root, 'opencode')).status, 'current');
  await writeFile(first.file, 'user edits');
  await assert.rejects(setupSkill(root, 'opencode'), { code: 'FILE_EXISTS' });
  assert.equal(await readFile(first.file, 'utf8'), 'user edits');
  assert.equal((await setupSkill(root, 'opencode', true)).status, 'installed');
  assert.equal((await setupSkill(root, 'agents')).status, 'installed');
});

test('CLI reports invalid timestamps as JSON and exits nonzero', async () => {
  await assert.rejects(run(process.execPath, ['src/cli.js', 'inspect', '.', '--at', '1,']), error => {
    assert.equal(error.details.status, 1);
    assert.equal(JSON.parse(error.details.stderr).error.code, 'INVALID_TIME');
    return true;
  });
});
