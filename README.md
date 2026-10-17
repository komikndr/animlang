# animlang

Create animations with your coding agent. Describe what you want, inspect the frames, and export an MP4.

Supports GSAP, Three.js, Vanta, and Manim through your existing agent harness.

## Install

**Just copy the git URL into your harness.**

Ask your agent:

> Install animlang from this repository, install its dependencies, and add the animlang skill to my harness.

Restart your harness after it installs the skill. Then describe the animation you want.

## Video examples

### GSAP

[Watch the video](output/demos/qwen-architecture.mp4)

> **Prompt:** "Animate the Qwen architecture with camera zooms into its layers and matrix operations."

### Three.js

[Watch the video](output/demos/qkv-cyberpunk.mp4)

> **Prompt:** "Show Q, K, and V projections in 3D with a futuristic cyberpunk style."

### Manim

[Watch the video](output/demos/manim-qkv-stack.mp4)

> **Prompt:** "Animate matrix multiplication, then combine the results into a 3D stack in a 3Blue1Brown-inspired style."

The video links point to local exports. Scene sources are in [`examples/`](examples/).

## Manual setup

Requires Node.js 22.12+, FFmpeg, and ffprobe. Manim also requires Python and [Manim Community](https://docs.manim.community/en/stable/installation/uv.html).

From the checkout:

```sh
npm install
npx playwright install chromium
node src/cli.js setup /path/to/your/project --harness opencode
node src/cli.js doctor
```

Use `--harness claude` or `--harness agents` for other skill directories.

## CLI

```sh
node src/cli.js init demo --template gsap
npm install --prefix demo
node src/cli.js inspect demo --at 0,2,6
node src/cli.js render demo --output demo/output/demo.mp4
```

Templates: `gsap`, `three`, `vanta`, and `manim`.
The [agent skill](.opencode/skills/animlang/SKILL.md) contains the scene workflow and rendering instructions.

## Development

```sh
npm run check
npm test
npm run test:integration
```
