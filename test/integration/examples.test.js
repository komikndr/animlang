import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { loadProject, packageRoot } from '../../src/project.js';
import { openBrowserScene } from '../../src/browser.js';
import { run } from '../../src/process.js';

for(const [name,times] of [
  ['qwen-architecture',[5.7,0,22,32,47,5.7,0]],
  ['qkv-cyberpunk',[8,0,16,22,29,8,0]],
]) {
  test(`${name}: reverse seeks and fresh sessions reproduce frames`, {
    skip:!process.env.ANIMLANG_TEST_EXAMPLES,timeout:120000,
  },async t=>{
    const parent=path.join(packageRoot,'.test-output');
    await mkdir(parent,{recursive:true});
    const output=await mkdtemp(path.join(parent,`${name}-`));
    if(!process.env.ANIMLANG_KEEP_TEST_OUTPUT) t.after(()=>rm(output,{recursive:true,force:true}));
    const project=await loadProject(path.join(packageRoot,'examples',name));
    const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
    const equivalent=async (first,second,message)=>{
      if(await digest(first)===await digest(second)) return;
      // Browser compositing and transparent WebGL edges can round channels differently.
      // 65 dB limits full-frame RMS error to less than 0.15 of one 8-bit channel level.
      const result=await run('ffmpeg',['-hide_banner','-i',first,'-i',second,'-lavfi','psnr','-f','null','-']);
      const score=result.stderr.match(/average:([\d.]+|inf)/)?.[1];
      assert.ok(score==='inf'||Number(score)>=65,`${message}: PSNR ${score} dB`);
    };
    const scene=await openBrowserScene(project);
    try {
      for(const [index,time] of times.entries()) {
        const file=path.join(output,`${index}.png`);
        await scene.capture(time,file);
      }
    } finally {await scene.close();}
    await equivalent(path.join(output,'0.png'),path.join(output,'5.png'),'a reverse seek must reproduce the same frame');
    await equivalent(path.join(output,'1.png'),path.join(output,'6.png'),'zero must reset camera, highlights, and visible objects');
    const fresh=await openBrowserScene(project);
    try {
      const file=path.join(output,'fresh.png');await fresh.capture(times[0],file);
      await equivalent(path.join(output,'0.png'),file,'a fresh session must match the same timestamp');
    } finally {await fresh.close();}
  });
}
