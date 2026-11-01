# RALLY — Squash Club / Courtside Edition

An original browser squash game with a procedural 3D glass court, articulated athletes, a ballistic shot planner and a tactical AI opponent. No original arcade game assets or ROMs are included.

## Play online

[![Play RALLY](https://img.shields.io/badge/Play_RALLY-Open_game-9acd32?style=for-the-badge)](https://rally-squash-rahbar.fuzzycoin2.chatgpt.site)
[![Request access](https://img.shields.io/badge/Request_access-Email_Rahbar-2563eb?style=for-the-badge)](<mailto:rahbar916@gmail.com?subject=RALLY%20Squash%20Club%20access%20request&body=Hi%20Rahbar%2C%0D%0A%0D%0AI'd%20like%20access%20to%20RALLY%20-%20Squash%20Club.%0D%0A%0D%0AMy%20ChatGPT%20account%20email%3A%20%0D%0AName%20(optional)%3A%20%0D%0A%0D%0AGame%3A%20https%3A%2F%2Frally-squash-rahbar.fuzzycoin2.chatgpt.site%0D%0A%0D%0AThank%20you!>)

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
- Touch screens have Serve/Swing, shot buttons, tap-to-place aiming, and an optional movement joystick.

Swing assist and assisted footwork are enabled by default. Footwork positions the body beside the ball, then recovers toward the T. Manual input always overrides assistance; either assist can be disabled in the clubhouse. Orange marks the live ball, its trail and the predicted incoming bounce. The outlined ball maintains a minimum visible screen size even at the front wall.

Quick match uses rally scoring, first to 11 and win by two. Solo practice counts returns and resets. Best rally is stored locally in the browser. Rookie play is slower and the AI reacts later; higher levels improve speed, reaction and volley decisions. AI timing has finite precision, especially on stretched returns.

## What changed in version 3

- Assisted mobile controls with separate shot selection and swing, optional joystick movement, left-handed placement, and advanced shots.
- An interactive first-rally guide that advances when you perform each task.
- An original Blender athlete and racket with authored animation accents, bounded contact poses, and planted stance feet.
- Manual stretched returns lose some placement precision; assisted shots remain forgiving.
- Distinct court impacts, footsteps, shoe squeaks, persistent mute, and Low/Medium/High graphics presets.
- Source/build separation, reproducible asset scripts, lint and formatting checks, and browser regression tests.

## Run locally

Use Node.js 24. Run `npm ci`, `npm run build`, then `npm run dev` and open `http://127.0.0.1:8000`. WebGL 2 is required. The built game is static and has no backend, API key, or runtime CDN dependency. See [CONTRIBUTING.md](CONTRIBUTING.md) for development commands and [the development guide](docs/development.md) for architecture, Blender exports, and release checks.

On mobile, tap the court to aim, select a shot, and tap **Serve/Swing**. Shot buttons select without swinging. Automatic footwork is the default; **Controls & graphics** offers manual movement, left-handed controls, and quality presets. **More shots** reveals Lob and Boast.

## GitHub and hosting

The play link above opens the game hosted on ChatGPT Sites. Its invitation-only access applies to that hosted Site; the source in this repository can also be run locally.

To approve a request, the owner opens the Site in ChatGPT Sites, selects **Share**, keeps access set to **Only those invited**, and invites the requested email address as a **Viewer**. Requests arrive by email; replying to an email alone does not grant access. See the [official Sites sharing instructions](https://learn.chatgpt.com/docs/sites/publishing-and-sharing).

The included [GitHub Actions workflow](.github/workflows/pages.yml) runs lint, formatting checks, syntax checks, simulation tests, a production build, and browser smoke tests on pushes to `main` and pull requests. It does not deploy the game on push.

GitHub Pages publishing is optional: first enable **Settings → Pages → Source → GitHub Actions**, then manually run **Check game and optionally publish Pages** from the **Actions** tab on `main` with **publish_pages** checked. This publishes `dist/` as a separate copy that does not inherit ChatGPT Sites access restrictions. Leave it unchecked to run checks only.

## Structure

- `src/`: simulation, rendering, player animation, input/UI, audio, and vendored Three.js modules.
- `public/`: clubhouse HTML, styles, and exported GLB assets.
- `assets/blender/`: editable athlete source; regenerate with `scripts/create-athlete.py` in Blender.
- `dist/`: generated static deployment output.
- `tests/`: simulation, contact, asset, tutorial, and browser checks, including 135 shot situations and complete match progression.

Run `npm test` and `npm run check` with Node.js. Three.js 0.180.0 is vendored under its MIT license in `src/vendor/`. This export runs independently of the original hosted Site.

## Validation and scope

Simulation regression tests and Chromium tests cover desktop, portrait, and landscape layouts, including two simultaneous touches, interrupted movement, and asset failures. Browser screenshots verify the exported athlete and contact poses. Physical-phone testing and hardware frame-rate targets have not been verified; headless software rendering is not representative of phone performance. See the development guide for the acceptance checklist.

This is a single-player arcade squash game. Serves use simplified service-box handling; player interference, let/stroke adjudication, online multiplayer and motion-captured animation are not implemented.
