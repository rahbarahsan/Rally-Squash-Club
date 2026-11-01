# RALLY — Squash Club / Courtside Edition

An original browser squash game with a procedural 3D glass court, articulated athletes, a ballistic shot planner and a tactical AI opponent. No original arcade game assets or ROMs are included.

## GitHub and releases

See [GITHUB_SETUP.md](GITHUB_SETUP.md) to upload the source, develop locally, publish a playable GitHub Pages site, and create versioned releases. The included workflow runs checks on pull requests and publishes `dist/` from `main` after Pages is enabled.

## Play

Click the court, or a corner on the placement pad, to choose the first floor bounce. A white dashed trajectory previews the shot; a lime reticle marks its destination. Deep targets produce length; short targets produce drops.

- **Space**: serve or swing the selected shot. An early swing request attempts a volley.
- **Z / C / E / Q / B**: straight length / crosscourt / drop / lob / boast.
- **1 / 2 / 3**: left placement / natural shot placement / right placement.
- **WASD or arrow keys**: move manually. **Hold R** to recover to the T.
- **V**: courtside or tactical camera. **Esc / P**: pause.
- Touch screens have a movement joystick, shot buttons and tap-to-place aiming.

Swing assist and assisted footwork are enabled by default. Footwork positions the body beside the ball, then recovers toward the T. Manual input always overrides assistance; either assist can be disabled in the clubhouse. Orange marks the live ball, its trail and the predicted incoming bounce. The outlined ball maintains a minimum visible screen size even at the front wall.

Quick match uses rally scoring, first to 11 and win by two. Solo practice counts returns and resets. Best rally is stored locally in the browser. Rookie play is slower and the AI reacts later; higher levels improve speed, reaction and volley decisions. AI timing has finite precision, especially on stretched returns.

## What changed in version 2

- Court camera fitted to the playable area, with a much wider default desktop view; overhead fixtures are hidden during matches.
- A high-contrast outlined ball, screen-size protection, orange trail and height guide.
- Floor-destination targeting instead of aiming at the middle of the front wall.
- Separate straight, crosscourt, drop, lob and side-wall-first boast trajectories, including previews of their actual physics.
- Acceleration and braking, hitting-room offsets, optional automatic positioning and T recovery.
- Articulated legs and arms with bounded limb lengths, side-on preparation, forehand/backhand lunges and contact-to-follow-through animation.
- Tactical shot selection, selective volleys and finite timing precision for the opponent.

## Run locally

Serve `dist/` with any static web server, for example `python -m http.server 8000 --directory dist`, then visit `http://localhost:8000`. WebGL 2 is required. There is no backend, API key, account integration, build step or runtime CDN dependency.

## Structure

- `dist/engine.js`: physics, ballistic shot planning, movement, scoring, interception and AI.
- `dist/scene.js`: court, ball visibility, trajectory previews, effects and rendering.
- `dist/athlete.js`: articulated player rig and movement poses.
- `dist/camera.js`: viewport-aware court framing and projection helpers.
- `dist/game.js`: controls, sound, UI and lifecycle.
- `dist/index.html` / `dist/style.css`: clubhouse, responsive HUD and help.
- `tests/`: 23 regression checks, including 135 shot situations, scoring, complete match progression, viewport framing, ball pixel size and limb-length constraints.

Run `npm test` and `npm run check` with Node.js. Three.js 0.180.0 is vendored under its MIT license in `dist/vendor/`. This export runs independently of the original hosted Site.

## Validation and scope

Simulation, camera projection, input wiring and rig constraints were checked locally. Static CPU-projected poses were inspected to catch limb stretching; this is not a browser render or interactive playtest. Live browser QA remains unavailable in this environment.

This is a single-player arcade squash game. Serves use simplified service-box handling; player interference, let/stroke adjudication, online multiplayer and motion-captured animation are not implemented.
