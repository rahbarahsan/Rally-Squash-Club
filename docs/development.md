# Development and release guide

## Architecture

`src/engine.js` owns physics, movement, scoring, shot quality, and AI. It has no browser dependencies. The game controller coordinates simulation events with the UI; input, tutorial state, audio, asset loading, camera framing, and dynamic trajectory buffers live in separate modules. Rendering reads simulation state; it cannot award points or change ball velocity.

JavaScript source and vendored libraries live in `src/`; HTML, CSS, and runtime assets live in `public/`. The Node build validates its output path, rejects symlinks, clears only the project’s `dist/`, and copies source and public files into that generated directory. Never hand-edit or commit build output.

## Blender assets

Run Blender with `--background --python scripts/create-athlete.py`. The generator creates the editable `assets/blender/athlete.blend` and `public/models/athlete.glb`. Geometry and materials are original. Coordinates are specified in game space (metres, Y up) and converted to Blender Z up; glTF converts them back on export.

The skin has named attachment bones for torso, head, neck, shorts, upper/lower arms, hands, thighs, shins, shoes, and racket. Connected arm/leg surfaces blend weights across elbows and knees; upper/lower arm frames share a bend plane to avoid axial twisting. The jersey is remeshed into a continuous surface with shoulder weights. Connected sports shorts blend pelvis and thigh weights so their longer cuffs follow lunges. Segment bind bones point downwards, with attachment geometry placed into that bind pose during generation. Each frame, bounded procedural limb poses retarget those bones in world space. The authored clips provide subtle torso/head accents; locomotion and ball-height corrections remain procedural. This keeps the racket attached to its hand and the contact point aligned to the simulation.

The eleven clips are Ready, Split, Move, Recover, Forehand, Backhand, Lunge, Volley, Serve, Win, and Lose. Runtime chooses them from simulation phase, stroke type, height, movement, and winner. The loader validates required bones before hiding the procedural fallback. Tests verify exported skin, racket, clips, and a 5 MB asset budget. Match loader code to the pinned Three.js 0.180.0 version.

To inspect poses, run the dev server, then `node scripts/asset-check.mjs`. It writes ignored images under `artifacts/` for forehand, backhand, low contact, volley, and follow-through. `node scripts/visual-check.mjs` captures menu/court layouts and a browser timing report. Do not treat SwiftShader timings as real-device performance.

## Tests and tooling

Run `npm ci`, `npx playwright install chromium`, and `npm run validate`. Formatting uses Prettier; lint uses ESLint recommended correctness rules. Generated files and vendored libraries are excluded. A minimatch override selects the patched dependency; reconsider it when ESLint adopts a patched version directly. The lockfile records exact installed versions.

Tests cover scoring, trajectories, complete matches, manual penalties, reachable contact, limb bounds, tutorial ordering, buffer reuse, and export contracts. Chromium runs desktop, portrait, and landscape scenarios, including actual two-touch input, resize/cancellation, advanced-shot visibility, and failed asset downloads. Browser workers run serially to limit software-renderer contention.

## Manual acceptance

Version 3.1 adds `controls.js` for persistent action bindings and owner-tracked charging, and `strike.js` for bounded power/depth effects. Keyboard shortcuts charge on keydown and release on keyup. Touch owns a captured pointer; cancellation, pause, blur, and resize discard charge without shooting. Swing assist continues automatic returns when no charge is held. During an explicit charge, it waits for release. Quick taps are soft shots; charge caps after 900 ms. Incoming ball pace adds modest carry, and queued/low late contact reduces accuracy. Placement remains physically planned and arcade-friendly, rather than a full racket/ball collision model.

WASD movement, arrow aiming, Space swing and Z/C/E/Q/B shot shortcuts are the defaults. The clubhouse editor swaps occupied key assignments and saves them locally; arrow movement is optional. Escape remains reserved for pause/dialog dismissal. Desktop shows every shot, with More shots restricted to compact screens. Controls and help should always describe the saved bindings.

Court audio uses original short synthesized transients, not recorded samples: distinct surface envelopes, four cached variants, speed-sensitive volume, stereo position and two short reflections. Browser tests can verify playback without errors; listening on speakers/headphones remains a manual quality check.

The 4K browser check verifies visible controls, bounded render-buffer pixel count and serving. AirPlay/Google screen mirroring is an operating-system feature, and no real TV/casting hardware has been verified. The game remains single-player. Two-phone input, shared rooms, online synchronization and a TV receiver/controller mode are future features, not provided by mirroring.

Version 3.1 also adds `display.js` for optional fullscreen/orientation capabilities, `feedback.js` for contact messages, `tactics.js` for opponent profiles, and `practice.js` for browser-independent challenge scoring. Deep targets count actual first floor bounces after non-serve returns; recovery counts once per return, and rally faults reset the streak. Practice bests are stored locally and separated by swing-assist setting. The recovery drill has a touch Recover T button; keyboard players can hold R.

Landscape is requested only by a user gesture. Unsupported/denied fullscreen or rotation APIs produce instructions and leave portrait play usable. Orientation support must still be checked on physical Android/iOS browsers. Do not simulate screen rotation with a CSS transform, since that would distort input coordinates and safe areas.

On a physical phone, play a complete match in both orientations, try two-thumb movement/swing, handedness, advanced shots, audio, pause/resume, and the tutorial. Confirm safe-area spacing and ball readability. On representative desktop/mobile hardware, record browser, GPU/device, preset, and median/p95 frame time. Targets are 60 FPS desktop and at least 30 FPS mobile on Low; these targets are not yet hardware-verified.

## Release and rollback

Run validation and inspect the diff. Commit only when the user asks, using the configured human identity, then show the commit summary. Wait for the user's publication decision before pushing or deploying; verify GitHub Actions after an approved push. Never add ChatGPT author, committer, contributor, or co-author attribution to a commit. Preserve third-party license notices. Keep commercial research in ignored `artifacts/` and out of Git.

The main game is the invitation-only ChatGPT Site. Open its existing source checkout using the Sites workflow, copy the verified source, build, package, and deploy while retaining its project ID and audience. GitHub Pages is a separate manual opt-in deployment. Keep the previous saved Site version ID for rollback; redeploy that saved version if a production regression appears.
