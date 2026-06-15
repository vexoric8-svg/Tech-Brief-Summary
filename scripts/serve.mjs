// Minimal static file server for local preview. Pure Node, no dependencies.
// Usage: node scripts/serve.mjs [port]   (default 5050)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 5050;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://localhost`).pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
