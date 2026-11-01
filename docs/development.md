# Development and release guide

## Architecture

`src/engine.js` owns physics, movement, scoring, shot quality, and AI. It has no browser dependencies. The game controller coordinates simulation events with the UI; input, tutorial state, audio, asset loading, camera framing, and dynamic trajectory buffers live in separate modules. Rendering reads simulation state; it cannot award points or change ball velocity.

JavaScript source and vendored libraries live in `src/`; HTML, CSS, and runtime assets live in `public/`. The Node build validates its output path, rejects symlinks, clears only the project’s `dist/`, and copies source and public files into that generated directory. Never hand-edit or commit build output.

## Blender assets

Run Blender with `--background --python scripts/create-athlete.py`. The generator creates the editable `assets/blender/athlete.blend` and `public/models/athlete.glb`. Geometry and materials are original. Coordinates are specified in game space (metres, Y up) and converted to Blender Z up; glTF converts them back on export.

The rigid-weight skin has named attachment bones for torso, head, neck, shorts, upper/lower arms, hands, thighs, shins, shoes, and racket. Each frame, bounded procedural limb poses retarget those bones in world space. The authored clips provide subtle torso/head accents; locomotion and ball-height corrections remain procedural. This keeps the racket attached to its hand and the contact point aligned to the simulation.

The eleven clips are Ready, Split, Move, Recover, Forehand, Backhand, Lunge, Volley, Serve, Win, and Lose. Runtime chooses them from simulation phase, stroke type, height, movement, and winner. The loader validates required bones before hiding the procedural fallback. Tests verify exported skin, racket, clips, and a 5 MB asset budget. Match loader code to the pinned Three.js 0.180.0 version.

To inspect poses, run the dev server, then `node scripts/asset-check.mjs`. It writes ignored images under `artifacts/` for forehand, backhand, low contact, volley, and follow-through. `node scripts/visual-check.mjs` captures menu/court layouts and a browser timing report. Do not treat SwiftShader timings as real-device performance.

## Tests and tooling

Run `npm ci`, `npx playwright install chromium`, and `npm run validate`. Formatting uses Prettier; lint uses ESLint recommended correctness rules. Generated files and vendored libraries are excluded. A minimatch override selects the patched dependency; reconsider it when ESLint adopts a patched version directly. The lockfile records exact installed versions.

Tests cover scoring, trajectories, complete matches, manual penalties, reachable contact, limb bounds, tutorial ordering, buffer reuse, and export contracts. Chromium runs desktop, portrait, and landscape scenarios, including actual two-touch input, resize/cancellation, advanced-shot visibility, and failed asset downloads. Browser workers run serially to limit software-renderer contention.

## Manual acceptance

On a physical phone, play a complete match in both orientations, try two-thumb movement/swing, handedness, advanced shots, audio, pause/resume, and the tutorial. Confirm safe-area spacing and ball readability. On representative desktop/mobile hardware, record browser, GPU/device, preset, and median/p95 frame time. Targets are 60 FPS desktop and at least 30 FPS mobile on Low; these targets are not yet hardware-verified.

## Release and rollback

Run validation, inspect the diff and Git author/committer metadata, commit with the configured human identity, push, and verify GitHub Actions. Never add ChatGPT author, committer, contributor, or co-author attribution to a commit. Preserve third-party license notices.

The main game is the invitation-only ChatGPT Site. Open its existing source checkout using the Sites workflow, copy the verified source, build, package, and deploy while retaining its project ID and audience. GitHub Pages is a separate manual opt-in deployment. Keep the previous saved Site version ID for rollback; redeploy that saved version if a production regression appears.
