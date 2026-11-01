# Development rules

- Preserve the configured human Git identity. Never add ChatGPT author, committer, contributor, or co-author attribution to commits or commit messages.
- Preserve third-party license notices.
- Edit src/ and public/, then regenerate dist/ with npm run build.
- Run npm run lint, npm run format:check, npm test, and npm run build before committing.
- Keep simulation independent of the browser. Add meaningful regression tests for gameplay changes.
- Keep the hosted Site invitation-only. GitHub Pages publishing is manual.
