import { cp, mkdir, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  output = resolve(root, 'dist');
if (dirname(output) !== root)
  throw new Error('Build output must stay inside the project');
const info = await lstat(output).catch((e) => {
  if (e.code !== 'ENOENT') throw e;
});
if (info?.isSymbolicLink())
  throw new Error('Refusing to replace a linked build directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'public'), output, { recursive: true });
await cp(resolve(root, 'src'), output, { recursive: true });
