---
name: animlang
description: Use when creating or editing animlang animations with GSAP, Three.js, Vanta, or Manim, inspecting scene frames, or exporting MP4 video.
compatibility: Requires the animlang CLI, Node.js 22.12+, Chromium for browser scenes, and FFmpeg. Manim scenes also require Python and Manim Community.
---

# Author an animlang scene

## Choose the engine

Use native scene code.
Use GSAP for diagrams, text, interfaces, and 2D motion.
Use Three.js for geometry, cameras, lighting, and 3D motion.
Use Manim Community for mathematical explanations and its native animation objects.
Use the Vanta template for a procedural CLOUDS background.

## Start a project

1. Run `animlang init <directory> --template gsap`, `three`, `vanta`, or `manim`.
2. For a browser project, run `npm install` in the project directory.
3. For a Manim project, create a project `.venv` and install `requirements.txt`.
4. Read `animlang.json` and the generated scene before an edit.
5. Edit the native JavaScript or Python scene.

If the CLI is not on PATH, run `node <animlang-checkout>/src/cli.js` with the same arguments.

## Browser scene interface

Keep the scene interface small:

```js
window.animlang = {
  duration: 6,
  ready: document.fonts.ready,
  seek(seconds) {
    timeline.totalTime(seconds, true);
    updateCaption(seconds);
    // For Three.js, render after all scene and camera updates.
    renderer.render(scene, camera);
  },
};
```

Set `duration` to a finite, positive number of seconds.
Expose a `ready` promise for fonts, textures, models, and other asynchronous assets.
Resolve that promise only after the assets can appear in a frame.
Return a promise from `seek` for asynchronous frame updates.

Make each frame depend on its timestamp, not previous captures.
Keep GSAP timelines paused.
Use explicit initial values in GSAP tweens.
Set captions and camera transforms directly inside `seek`.
Do not use timeline callbacks to store visible state.
Do not use wall-clock time, unseeded randomness, CSS animations, or independent animation loops during capture.
For simulation scenes, reset and advance fixed steps before each requested timestamp.

The generated `capture.js` provides normal browser playback outside CLI capture.
The CLI sets `window.__ANIMLANG_CAPTURE__` before the scene loads.

The legacy interface also works:

```js
window.READY = true;
window.ANIM_DURATION = () => timeline.duration();
window.seekFrame = seconds => {
  timeline.totalTime(seconds, true);
  updateCamera();
  updateCaption(seconds);
};
```

## Vanta constraints

Keep the generated Vanta and Three.js versions pinned.
The CLOUDS template stops the Vanta loop and sets the shader clock directly.
This adapter uses Vanta internals and supports only CLOUDS in Vanta 0.5.24.
If you change the effect, implement and verify its time control before export.

## Manim scenes

Keep the Python `Scene` class name in `animlang.json`.
Use native Manim animations and timing.
Keep the configured dimensions and frame rate.
Use `Text` for labels that do not need LaTeX.
If the scene uses `MathTex` or `Tex`, install a LaTeX distribution.

The CLI renders the full scene before it extracts selected PNG frames.
Manim inspection times refer to encoded video frames.
The inspection result reports `actualTime` for each requested timestamp.

## Inspect, revise, export

1. Run `animlang inspect <directory> --at 0,1.5,3` with times inside the scene duration.
2. Open every returned PNG with the image tool in the agent harness.
3. Examine labels, contrast, clipping, alignment, captions, and the visible explanation.
4. Inspect important transitions and the final frame.
5. Request a repeated timestamp in reverse order, such as `--at 2,0,2`.
6. Verify that the two frames at the repeated timestamp match.
7. Correct the scene and inspect the changed times again.
8. Run `animlang render <directory> --output <file>.mp4`.
9. Report the final video path and the inspection results.

For a short export, use `--from <seconds> --to <seconds>`.
The end time is exclusive.
Read successful command results as JSON from stdout.
Read runtime errors as JSON from stderr.
If a command fails, read `error.code`, `error.message`, and `error.details` before the next edit.
If Chromium or FFmpeg is unavailable, run `animlang doctor`.
Do not report a successful export until the render command succeeds.
