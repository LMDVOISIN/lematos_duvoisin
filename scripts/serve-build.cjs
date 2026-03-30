const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const args = process.argv.slice(2);
const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
};

const host = getArgValue('--host', '127.0.0.1');
const port = Number(getArgValue('--port', '4173'));
const rootDir = path.resolve(process.cwd(), 'build');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const sanitizePath = (pathname) => {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return normalized;
};

const resolveFilePath = (requestPath) => {
  const sanitizedPath = sanitizePath(requestPath);
  const candidatePath = path.join(rootDir, sanitizedPath);

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    const indexPath = path.join(candidatePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return path.join(rootDir, 'index.html');
};

const server = http.createServer((request, response) => {
  try {
    const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
    const filePath = resolveFilePath(parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname);

    fs.readFile(filePath, (error, buffer) => {
      if (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Unable to read build output.');
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[extension] || 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
      response.end(buffer);
    });
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`[serve-build] Serving ${rootDir} at http://${host}:${port}`);
});
