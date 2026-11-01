# Version 3 implementation status

Implemented:

- Assisted mobile controls, separate shot selection and swing, optional manual joystick, handedness, quality settings, and persistent mute.
- Pointer ownership, simultaneous movement/swing, cancellation, resize reset, and viewport-aware control placement.
- Task-driven tutorial: serve, aim, select, return, recover. Restart and exit close it.
- Original Blender athlete and racket, eleven animation states, runtime contact/limb retargeting, stance-foot planting, and procedural fallback.
- Simulation-scaled animation, bounded racket reach, and manual stretched-shot placement penalties with feedback.
- Court impacts, footsteps, shoe squeaks, cached audio buffers, and reused trajectory buffers.
- Source/public/build separation, lockfile, lint, formatting, syntax, simulation, asset, and browser checks in CI.
- Development, export, release, and commit-attribution documentation.

Verification limits:

- Browser touch tests use Chromium device emulation, including actual simultaneous touch events. They do not replace a hands-on phone playtest.
- Desktop/phone hardware performance targets remain unverified. Screenshots and timing from headless SwiftShader are useful regression evidence, not a hardware benchmark.
- This remains an arcade simulation: no multiplayer, player interference adjudication, or motion-captured animation.

Run `npm run validate` before release. See [development notes](development.md) for manual acceptance and rollback steps.
