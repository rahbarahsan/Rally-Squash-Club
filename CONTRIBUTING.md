# Contributing

Use Node.js 24 and npm. Run `npm ci`, `npm run build`, then `npm run dev` and open http://127.0.0.1:8000.

Edit JavaScript in `src/` and HTML, CSS, and exported assets in `public/`. `dist/` is generated deployment output. Do not hand-edit it. Run `npm run build` after changes.

Before committing run `npm run format`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:browser`. Install Chromium once with `npx playwright install chromium`. CI runs formatting in check-only mode. Vendor files and generated files are excluded from formatting and linting.

Use focused commits describing the behavior changed. Preserve the configured human Git identity. Do not add ChatGPT authorship, contributor statements, or co-author trailers to commits. Preserve licenses and notices for third-party dependencies.

See [development notes](docs/development.md) for architecture, assets, and release validation.
