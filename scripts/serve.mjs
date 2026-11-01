import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      const file = resolve(
        root,
        '.' + (pathname === '/' ? '/index.html' : pathname),
      );
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.glb': 'model/gltf-binary',
          '.wav': 'audio/wav',
        }[extname(file)] || 'application/octet-stream',
      );
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  })
  .listen(8000, '127.0.0.1');
