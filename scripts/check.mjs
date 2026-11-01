import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const file of await readdir('src'))
  if (file.endsWith('.js')) {
    const r = spawnSync(process.execPath, ['--check', `src/${file}`], {
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
