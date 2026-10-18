# AnimLang

Create animations with your coding agent. Describe what you want, inspect the frames, and export an MP4.

Supports GSAP, Three.js, Vanta, and Manim through your existing agent harness.

## Install

**Just copy the git URL into your harness.**

Ask your agent:

> Install animlang from https://github.com/komikndr/animlang, install its dependencies, and add the animlang skill to my harness.

Restart your harness after it installs the skill. Then describe the animation you want.

### npm setup

Animlang is available on [npm](https://www.npmjs.com/package/animlang). Install the project skill with:

```sh
npx animlang@latest setup . --harness opencode
```

Use `--harness claude` or `--harness agents` for other skill directories. Restart your harness after installation.
The skill gives your agent the scene workflow. The CLI creates projects, captures frames, and exports video.

## Video examples

### GSAP

https://github.com/user-attachments/assets/e76d745d-6c8a-4fa5-ae2c-f131d655b137

> **Prompt:** "Animate the Qwen 3.8 Flash Next architecture. Zoom into the embedding, GDN, QSA, LM head, and MTP layers, and show matrix operations."

### Three.js

https://github.com/user-attachments/assets/8b5d3598-cfc2-45cd-be22-86d722e5f161

> **Prompt:** "Show Q, K, and V projections matmul in 3D with a futuristic cyberpunk style."

### Manim

https://github.com/user-attachments/assets/3abadb36-457c-4a4e-8c52-020cfdebc064

> **Prompt:** "Animate matrix multiplication, then combine the results into a 3D stack in a 3Blue1Brown-inspired style."

Scene sources are in [`examples/`](examples/).

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
The [agent skill](skills/animlang/SKILL.md) contains the scene workflow and rendering instructions.

Browser capture uses Chromium's sandbox and restricts local assets and network requests.
See [capture security](SECURITY.md) for shared asset flags, resource limits, and native-code execution boundaries.

## Development

```sh
npm run check
npm test
npm run test:integration
```
