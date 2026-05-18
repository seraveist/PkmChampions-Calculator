import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${HOST}:${PORT}`).pathname);
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const target = path.normalize(path.join(DIST, normalized));
  if (!target.startsWith(DIST)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return path.join(DIST, 'index.html');
}

const server = createServer((request, response) => {
  const target = resolveRequest(request.url || '/');
  if (!target || !existsSync(target)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const type = TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
  });
  response.end(readFileSync(target));
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${DIST} at http://${HOST}:${PORT}/`);
});
