import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(currentDir, 'site');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function baseHeaders(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const headers = {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
  };

  if (normalized.endsWith('/index.html') || normalized.endsWith('/sw.js') || normalized.endsWith('/manifest.webmanifest')) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else if (normalized.includes('/assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  if (normalized.endsWith('/sw.js')) {
    headers['Service-Worker-Allowed'] = '/';
  }
  return headers;
}

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://localhost').pathname);
  } catch {
    return null;
  }

  const relativePath = normalize(pathname).replace(/^([/\\])+/, '');
  let filePath = resolve(siteDir, relativePath);
  if (filePath !== siteDir && !filePath.startsWith(siteDir + sep)) return null;

  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
    if (statSync(filePath).isFile()) return filePath;
  } catch {
    // 前端路由统一回退到 index.html。
  }
  return join(siteDir, 'index.html');
}

const server = createServer((request, response) => {
  if (request.url === '/__health') {
    const body = JSON.stringify({ ok: true });
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    response.end(body);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Method Not Allowed');
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  let fileStat;
  try {
    fileStat = statSync(filePath);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  response.writeHead(200, {
    ...baseHeaders(filePath),
    'Content-Length': fileStat.size,
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `端口 ${port} 已被占用。可使用 DEVELOPER_TOOLBOX_PORT=其他端口 ./start.sh 启动。`,
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`开发者工具箱正在运行：http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
