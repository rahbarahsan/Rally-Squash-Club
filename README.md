# RALLY — Squash Club / Courtside Edition

An original browser squash game with a procedural 3D glass court, articulated athletes, a ballistic shot planner and a tactical AI opponent. No original arcade game assets or ROMs are included.

## Play online

[![Play RALLY](https://img.shields.io/badge/Play_RALLY-Open_game-9acd32?style=for-the-badge)](https://rally-squash-rahbar.fuzzycoin2.chatgpt.site)
[![Request access](https://img.shields.io/badge/Request_access-Email_Rahbar-2563eb?style=for-the-badge)](mailto:rahbar916@gmail.com?subject=RALLY%20Squash%20Club%20access%20request&body=Hi%20Rahbar%2C%0D%0A%0D%0AI'd%20like%20access%20to%20RALLY%20-%20Squash%20Club.%0D%0A%0D%0AMy%20ChatGPT%20account%20email%3A%20%0D%0AName%20(optional)%3A%20%0D%0A%0D%0AGame%3A%20https%3A%2F%2Frally-squash-rahbar.fuzzycoin2.chatgpt.site%0D%0A%0D%0AThank%20you!)

**[Open RALLY — Squash Club](https://rally-squash-rahbar.fuzzycoin2.chatgpt.site)** in your browser. No download or local setup is needed.

The hosted game is invitation-only. If you already have access, sign in with the ChatGPT account whose email address was invited.

**Need access?** Click **Request access** to open a prefilled email to Rahbar. Include the email address you use to sign in to ChatGPT, then send the request. Rahbar reviews requests individually and may invite you to play. Sending a request does not automatically grant access.

If the button does not open an email app, email **rahbar916@gmail.com** with the subject **RALLY Squash Club access request** and your ChatGPT account email. Once invited, return to **Play RALLY** and sign in with that account.

## How to play

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

## GitHub and hosting

The play link above opens the game hosted on ChatGPT Sites. Its invitation-only access applies to that hosted Site; the source in this repository can also be run locally.

To approve a request, the owner opens the Site in ChatGPT Sites, selects **Share**, keeps access set to **Only those invited**, and invites the requested email address as a **Viewer**. Requests arrive by email; replying to an email alone does not grant access. See the [official Sites sharing instructions](https://learn.chatgpt.com/docs/sites/publishing-and-sharing).

The included [GitHub Actions workflow](.github/workflows/pages.yml) runs syntax checks and tests on pushes to `main` and pull requests. It does not deploy the game on push.

GitHub Pages publishing is optional: first enable **Settings → Pages → Source → GitHub Actions**, then manually run **Check game and optionally publish Pages** from the **Actions** tab on `main` with **publish_pages** checked. This publishes `dist/` as a separate copy that does not inherit ChatGPT Sites access restrictions. Leave it unchecked to run checks only.

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
