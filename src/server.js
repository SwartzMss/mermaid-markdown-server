const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { buildHtml } = require('./page');
const { CLIENT_JS, STYLES_CSS } = require('./assets');

function createMarkdownServer({ file }) {
  const markdownPath = path.resolve(process.cwd(), file);
  const previewRoot = getPreviewRoot(markdownPath);
  const title = path.basename(markdownPath);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method !== 'GET') {
        send(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
        return;
      }

      if (url.pathname === '/') {
        send(response, 200, 'text/html; charset=utf-8', buildHtml({ title }));
        return;
      }

      if (url.pathname === '/content.md') {
        const markdown = await fs.readFile(markdownPath, 'utf8');
        send(response, 200, 'text/markdown; charset=utf-8', markdown, { 'Cache-Control': 'no-store' });
        return;
      }

      if (url.pathname === '/content') {
        const requestedPath = url.searchParams.get('path');
        const contentPath = requestedPath
          ? resolveRootRelativePath(previewRoot, requestedPath)
          : markdownPath;
        const markdown = await fs.readFile(contentPath, 'utf8');
        send(response, 200, 'text/markdown; charset=utf-8', markdown, { 'Cache-Control': 'no-store' });
        return;
      }

      if (url.pathname === '/raw') {
        const requestedPath = url.searchParams.get('path');
        if (!requestedPath) {
          send(response, 400, 'text/plain; charset=utf-8', 'Missing path');
          return;
        }

        const rawPath = resolveRootRelativePath(previewRoot, requestedPath);
        const data = await fs.readFile(rawPath);
        send(response, 200, contentTypeForPath(rawPath), data, { 'Cache-Control': 'no-store' });
        return;
      }

      if (url.pathname === '/assets/client.js') {
        send(response, 200, 'application/javascript; charset=utf-8', CLIENT_JS);
        return;
      }

      if (url.pathname === '/assets/styles.css') {
        send(response, 200, 'text/css; charset=utf-8', STYLES_CSS);
        return;
      }

      if (url.pathname === '/health') {
        send(response, 200, 'text/plain; charset=utf-8', 'ok');
        return;
      }

      send(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    } catch (error) {
      const message = error.code === 'ENOENT'
        ? `Markdown file not found: ${markdownPath}`
        : 'Internal Server Error';
      send(response, error.code === 'ENOENT' ? 404 : 500, 'text/plain; charset=utf-8', message);
    }
  });
}

function send(response, statusCode, contentType, body, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    ...headers
  });
  response.end(body);
}

function getPreviewRoot(markdownPath) {
  return path.dirname(path.resolve(markdownPath));
}

function resolveRootRelativePath(root, requestedPath) {
  const normalizedRequest = String(requestedPath || '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');
  const rootPath = path.resolve(root);
  const resolvedPath = path.resolve(rootPath, normalizedRequest);
  const relativePath = path.relative(rootPath, resolvedPath);

  if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    return resolvedPath;
  }

  throw new Error('Path is outside the preview root');
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.md': 'text/markdown; charset=utf-8',
    '.markdown': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8'
  };

  return types[extension] || 'application/octet-stream';
}

module.exports = {
  createMarkdownServer,
  getPreviewRoot,
  resolveRootRelativePath,
  contentTypeForPath
};
