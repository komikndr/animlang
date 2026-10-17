#!/usr/bin/env node
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { doctor, inspectProject, renderProject } from './commands.js';
import { initProject, parseTimes, setupSkill } from './project.js';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const program = new Command().name('animlang').version(version)
  .description('Create native animation scenes, inspect PNG frames, and export MP4 video.')
  .showHelpAfterError().exitOverride();

const output = result => { console.log(JSON.stringify(result, null, 2)); };
const captureOptions = command => command
  .option('--browser <path>', 'Chromium executable path')
  .option('--python <path>', 'Python executable for Manim')
  .option('--timeout <ms>', 'Host-side browser readiness and frame timeout', '30000')
  .option('--job-timeout <ms>', 'Overall inspection or render deadline', '1800000')
  .option('--max-frames <count>', 'Maximum captured frames', '18000')
  .option('--max-temp-mb <size>', 'Maximum temporary output per directory in MiB', '2048')
  .option('--allow-origin <origin>', 'Allow an additional HTTP(S) origin (repeatable)', (value, all) => [...all, value], [])
  .option('--allow-directory <path>', 'Allow an additional local asset directory (repeatable)', (value, all) => [...all, value], []);

program.command('init').argument('<directory>', 'New or empty project directory')
  .option('-t, --template <name>', 'gsap, three, vanta, or manim', 'gsap')
  .action(async (directory, options) => output(await initProject(directory, options.template)));

captureOptions(program.command('inspect').argument('[directory]', 'Project directory', '.')
  .option('--at <seconds>', 'Comma-separated frame times, in seconds', parseTimes))
  .action(async (directory, options) => output(await inspectProject(directory, options)));

captureOptions(program.command('render').argument('[directory]', 'Project directory', '.')
  .option('-o, --output <file>', 'MP4 output path, relative to the current directory')
  .option('--from <seconds>', 'Start time, inclusive')
  .option('--to <seconds>', 'End time, exclusive'))
  .action(async (directory, options) => output(await renderProject(directory, options)));

program.command('setup').argument('[directory]', 'Agent project directory', '.')
  .option('--harness <name>', 'opencode, claude, or agents', 'opencode')
  .option('--force', 'Replace an existing, different skill file', false)
  .action(async (directory, options) => output(await setupSkill(directory, options.harness, options.force)));

program.command('doctor').description('Check Chromium, FFmpeg, and ffprobe.')
  .action(async () => {
    const result = await doctor();
    output(result);
    if (!result.ok) process.exitCode = 1;
  });

try { await program.parseAsync(); }
catch (error) {
  if (error.code?.startsWith('commander.')) process.exitCode = error.exitCode;
  else {
    console.error(JSON.stringify({ error: { code: error.code ?? 'ANIMLANG_ERROR', message: error.message, details: error.details } }, null, 2));
    process.exitCode = 1;
  }
}
