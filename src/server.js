const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { buildHtml } = require('./page');
const { CLIENT_JS, STYLES_CSS } = require('./assets');

const VENDOR_ASSETS = {
  '/vendor/marked.min.js': {
    packageName: 'marked',
    relativePath: ['lib', 'marked.umd.js'],
    contentType: 'application/javascript; charset=utf-8'
  },
  '/vendor/mermaid.min.js': {
    packageName: 'mermaid',
    relativePath: ['dist', 'mermaid.min.js'],
    contentType: 'application/javascript; charset=utf-8'
  }
};

function createMarkdownServer({ file }) {
  let markdownPath;
  let previewRoot;
  let title;

  function setFile(nextFile) {
    markdownPath = path.resolve(process.cwd(), nextFile);
    previewRoot = getPreviewRoot(markdownPath);
    title = path.basename(markdownPath);
  }

  setFile(file);

  const server = http.createServer(async (request, response) => {
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

      const vendorAsset = vendorAssetForPath(url.pathname);
      if (vendorAsset) {
        const data = await fs.readFile(vendorAsset.filePath);
        send(response, 200, vendorAsset.contentType, data, { 'Cache-Control': 'public, max-age=31536000, immutable' });
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

  server.setFile = setFile;

  return server;
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

function vendorAssetForPath(pathname) {
  const asset = VENDOR_ASSETS[pathname];
  if (!asset) {
    return undefined;
  }

  return {
    ...asset,
    filePath: path.resolve(__dirname, '..', 'node_modules', asset.packageName, ...asset.relativePath)
  };
}

module.exports = {
  createMarkdownServer,
  getPreviewRoot,
  resolveRootRelativePath,
  contentTypeForPath,
  vendorAssetForPath
};
