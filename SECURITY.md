# Capture security

## Execution boundary

Animlang runs native animation projects. Manim executes the project's Python code with your user permissions. Dependency installation can execute package scripts.

Use an isolated container or virtual machine for projects that you do not trust. Restrict its filesystem, network, memory, and CPU resources.
The capture controls do not replace OS isolation. They do not sandbox Python or installed dependencies.

## Browser capture

Chromium uses its OS sandbox. Capture fails if that sandbox cannot start. Animlang does not retry with the sandbox disabled.

The Vite capture server listens on loopback. It does not load Vite, PostCSS, or environment files from the project or parent directories.
It does not expose host environment variables through `import.meta.env`.
Its live-reload client, control endpoints, WebSocket server, and automatic dependency scan are disabled during capture.

Local assets must stay inside the project directory. Real-path checks reject outside imports and symlink targets.
Vite also blocks its default sensitive file patterns, including `.env`, private keys, and `.git` files.
Keep credentials outside scene directories. Explicit asset directories grant access to their contents, except files that Vite blocks.

HTTP requests can use only the capture server's origin by default. WebSockets, service workers, and downloads are disabled.
HTTP redirects are blocked because browser routing does not reliably intercept every redirect hop.
Use the final asset URL for remote files.

For a required remote asset, allow its exact HTTP or HTTPS origin:

```sh
node src/cli.js inspect demo --allow-origin https://assets.example.com
```

For a required shared asset directory, allow that directory explicitly:

```sh
node src/cli.js inspect examples/qwen-architecture --at 0,22,47 --allow-directory examples/shared
node src/cli.js render examples/qkv-cyberpunk --allow-directory examples/shared
```

Both flags accept repeated values. Relative directory paths refer to the current working directory.
An allowed origin grants access to every path on that origin. WebSockets remain disabled.
These controls cover capture assets, not all browser internals or non-HTTP protocols. Use OS network isolation for hostile scenes.

## Resource limits

The default limits are:

| Resource | Limit |
| --- | --- |
| Browser readiness or frame operation | 30 seconds |
| Overall inspection or export | 30 minutes |
| Captured frames | 18,000 |
| Temporary output per directory | 2 GiB |
| Canvas side | 4,096 pixels |
| Total canvas pixels | 8,294,400 (3840 × 2160) |
| Frame rate | 120 FPS |

The host-side browser timeout stops synchronous loops that prevent page timers from firing.
An overall deadline also cancels Manim and FFmpeg. On POSIX systems, cancellation kills their process groups, including renderer subprocesses.
On Windows, cancellation kills the direct process. Use an OS job or container to constrain its descendants.

Temporary output size is measured after each browser frame and every 250 milliseconds during native rendering.
The periodic check can permit a brief size overshoot. Each temporary directory has its own limit.
The Manim frame limit applies after its native render. The deadline and size monitor apply during that render.
These limits do not cap all process memory or files that Python code writes outside temporary output directories.

For a larger trusted scene, set explicit limits:

```sh
node src/cli.js render demo --job-timeout 3600000 --max-frames 36000 --max-temp-mb 4096
```

Use `--timeout <ms>` to change the host-side browser operation timeout.
Failed captures remove their incomplete output directories.
