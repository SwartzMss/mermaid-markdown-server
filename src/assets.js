function pathWithoutSearchAndHash(value) {
  return String(value || '')
    .split('#')[0]
    .split('?')[0]
    .replaceAll('\\', '/');
}

function normalizePathSegments(value) {
  const segments = [];

  for (const segment of pathWithoutSearchAndHash(value).replace(/^\/+/, '').split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (segments.length > 0 && segments.at(-1) !== '..') {
        segments.pop();
        continue;
      }

      segments.push(segment);
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/');
}

function pathDirectory(value) {
  const normalizedPath = normalizePathSegments(value);
  const slashIndex = normalizedPath.lastIndexOf('/');

  return slashIndex === -1 ? '' : normalizedPath.slice(0, slashIndex);
}

function resolvePreviewPath(value, basePath) {
  const rawPath = pathWithoutSearchAndHash(value);
  if (rawPath.startsWith('/')) {
    return normalizePathSegments(rawPath);
  }

  const baseDirectory = pathDirectory(basePath);
  const pathFromBase = baseDirectory ? `${baseDirectory}/${rawPath}` : rawPath;

  return normalizePathSegments(pathFromBase);
}

function searchForPreviewPath(path) {
  const normalizedPath = normalizePathSegments(path);
  return normalizedPath ? `?path=${encodeURIComponent(normalizedPath)}` : '';
}

function pathFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return normalizePathSegments(params.get('path') || '');
}

const CLIENT_HELPERS_JS = [
  pathWithoutSearchAndHash,
  normalizePathSegments,
  pathDirectory,
  resolvePreviewPath,
  searchForPreviewPath,
  pathFromSearch
].map((helper) => helper.toString()).join('\n\n');

const CLIENT_JS = `
(function () {
  const root = document.getElementById('markdown-root');
  const status = document.getElementById('status');
  const documentNav = document.getElementById('document-nav');
  const documentNavList = document.getElementById('document-nav-list');
  const scriptTimeoutMs = 8000;
  const markedSources = [
    '/vendor/marked.min.js'
  ];
  const mermaidSources = [
    '/vendor/mermaid.min.js'
  ];
  let markedLoadPromise;
  let mermaidLoadPromise;
  let currentPath = '';

${CLIENT_HELPERS_JS}

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || 'info';
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = window.setTimeout(() => {
        script.remove();
        reject(new Error('Timed out loading ' + source));
      }, scriptTimeoutMs);

      script.src = source;
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timer);
        script.remove();
        reject(new Error('Failed to load ' + source));
      };

      document.head.appendChild(script);
    });
  }

  async function loadFirstAvailableScript(name, sources) {
    for (const source of sources) {
      try {
        await loadScript(source);
        return;
      } catch (_error) {
        // Try the next configured source.
      }
    }

    throw new Error(name + ' library failed to load from the local preview server.');
  }

  async function ensureMarked() {
    if (window.marked) {
      return;
    }

    markedLoadPromise = markedLoadPromise || loadFirstAvailableScript('Markdown', markedSources);
    await markedLoadPromise;
  }

  async function ensureMermaid() {
    if (window.mermaid) {
      return;
    }

    mermaidLoadPromise = mermaidLoadPromise || loadFirstAvailableScript('Mermaid', mermaidSources);
    await mermaidLoadPromise;
  }

  function prepareMermaidBlocks() {
    root.querySelectorAll('pre code.language-mermaid').forEach((code, index) => {
      const block = document.createElement('div');
      block.className = 'mermaid';
      block.dataset.diagram = String(index + 1);
      block.textContent = code.textContent;
      code.closest('pre').replaceWith(block);
    });
  }

  function isExternalUrl(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(value || '');
  }

  function contentEndpoint(relativePath) {
    return '/content?path=' + encodeURIComponent(relativePath);
  }

  function rawEndpoint(relativePath) {
    return '/raw?path=' + encodeURIComponent(relativePath);
  }

  function isMarkdownPath(value) {
    return /\\.(md|markdown)$/i.test(pathWithoutSearchAndHash(value));
  }

  function rewriteRelativeUrls(basePath) {
    root.querySelectorAll('img[src]').forEach((image) => {
      const source = image.getAttribute('src');
      if (!source || isExternalUrl(source)) {
        return;
      }

      image.setAttribute('src', rawEndpoint(resolvePreviewPath(source, basePath)));
    });

    root.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || isExternalUrl(href)) {
        return;
      }

      const relativePath = resolvePreviewPath(href, basePath);
      link.dataset.previewPath = relativePath;
      link.setAttribute('href', isMarkdownPath(href)
        ? previewUrlForPath(relativePath)
        : rawEndpoint(relativePath));
    });
  }

  async function loadDocumentNavigation() {
    if (!documentNav || !documentNavList) {
      return;
    }

    try {
      const response = await fetch('/documents', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const documentTree = await response.json();
      renderDocumentNavigation(documentTree.documents || []);
    } catch (_error) {
      documentNav.hidden = true;
    }
  }

  function renderDocumentNavigation(documents) {
    documentNavList.textContent = '';

    if (!documents.length) {
      documentNav.hidden = true;
      return;
    }

    documentNav.hidden = false;
    documentNavList.appendChild(renderDocumentNavigationList(documents, 0));
    setActiveDocument(currentPath);
  }

  function renderDocumentNavigationList(documents, depth) {
    const list = document.createElement('ul');
    list.className = depth === 0 ? 'document-nav__items' : 'document-nav__children';

    for (const documentNode of documents) {
      const item = document.createElement('li');
      item.className = 'document-nav__item';

      const link = document.createElement('a');
      const previewPath = normalizePathSegments(documentNode.path || '');
      link.className = 'document-nav__link';
      link.href = previewUrlForPath(previewPath);
      link.dataset.previewPath = previewPath;
      link.textContent = documentNode.title || previewPath || 'Markdown';
      item.appendChild(link);

      if (documentNode.children && documentNode.children.length) {
        item.appendChild(renderDocumentNavigationList(documentNode.children, depth + 1));
      }

      list.appendChild(item);
    }

    return list;
  }

  function setActiveDocument(path) {
    if (!documentNavList) {
      return;
    }

    const activePath = normalizePathSegments(path);
    documentNavList.querySelectorAll('.document-nav__link').forEach((link) => {
      if (normalizePathSegments(link.dataset.previewPath) === activePath) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  async function renderMarkdownPath(relativePath) {
    await ensureMarked();

    const nextPath = normalizePathSegments(relativePath);
    const endpoint = nextPath ? contentEndpoint(nextPath) : '/content';
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const markdown = await response.text();
    currentPath = nextPath;
    root.innerHTML = window.marked.parse(markdown, { breaks: false, gfm: true });
    rewriteRelativeUrls(currentPath);
    setActiveDocument(currentPath);
    await renderMermaid();
  }

  async function renderMermaid() {
    prepareMermaidBlocks();

    if (!root.querySelector('.mermaid')) {
      return;
    }

    try {
      await ensureMermaid();
    } catch (error) {
      setStatus(error.message || 'Mermaid library failed to load. Check your network connection.', 'error');
      return;
    }

    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    await window.mermaid.run({ querySelector: '.mermaid' });
  }

  function previewUrlForPath(path) {
    return window.location.pathname + searchForPreviewPath(path);
  }

  async function showPath(path, loadingMessage) {
    try {
      status.hidden = false;
      setStatus(loadingMessage || 'Loading markdown...');
      await renderMarkdownPath(path);
      setStatus('');
      status.hidden = true;
      return true;
    } catch (error) {
      status.hidden = false;
      setStatus(error.message || 'Failed to render markdown.', 'error');
      return false;
    }
  }

  async function render() {
    const initialPath = pathFromSearch(window.location.search);
    window.history.replaceState({ path: initialPath }, '', previewUrlForPath(initialPath));
    await loadDocumentNavigation();
    await showPath(initialPath, 'Loading markdown renderer...');
  }

  if (documentNavList) {
    documentNavList.addEventListener('click', async (event) => {
      const link = event.target.closest('a[data-preview-path]');
      if (!link) {
        return;
      }

      event.preventDefault();

      const nextPath = normalizePathSegments(link.dataset.previewPath);
      const rendered = await showPath(nextPath, 'Loading markdown...');
      if (rendered) {
        window.history.pushState({ path: currentPath }, '', previewUrlForPath(currentPath));
      }
    });
  }

  root.addEventListener('click', async (event) => {
    const link = event.target.closest('a[data-preview-path]');
    if (!link || !isMarkdownPath(link.dataset.previewPath)) {
      return;
    }

    event.preventDefault();

    const nextPath = normalizePathSegments(link.dataset.previewPath);
    const rendered = await showPath(nextPath, 'Loading markdown...');
    if (rendered) {
      window.history.pushState({ path: currentPath }, '', previewUrlForPath(currentPath));
    }
  });

  window.addEventListener('popstate', async (event) => {
    const path = event.state && typeof event.state.path === 'string'
      ? event.state.path
      : pathFromSearch(window.location.search);

    await showPath(path, 'Loading markdown...');
    setActiveDocument(path);
  });

  window.addEventListener('DOMContentLoaded', render);
})();
`;

const STYLES_CSS = `
:root {
  color-scheme: light;
  --bg: #f7f7f4;
  --text: #202124;
  --muted: #61656f;
  --border: #d9d9d2;
  --surface: #ffffff;
  --code-bg: #f0f1f3;
  --accent: #2563eb;
  --error: #b42318;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, "Microsoft YaHei", sans-serif;
  line-height: 1.65;
}

.preview-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 20px;
  width: min(1240px, calc(100% - 32px));
  margin: 32px auto 64px;
  align-items: start;
}

.document-nav {
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.document-nav__title {
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.document-nav__items,
.document-nav__children {
  margin: 0;
  padding: 0;
  list-style: none;
}

.document-nav__children {
  margin-left: 12px;
  padding-left: 10px;
  border-left: 1px solid var(--border);
}

.document-nav__item {
  margin: 2px 0;
}

.document-nav__link {
  display: block;
  overflow: hidden;
  padding: 6px 8px;
  color: var(--text);
  border-radius: 6px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-nav__link:hover {
  background: var(--code-bg);
}

.document-nav__link[aria-current="page"] {
  color: var(--accent);
  background: #e8f0ff;
  font-weight: 700;
}

.page-shell {
  min-width: 0;
  padding: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.status {
  margin-bottom: 16px;
  color: var(--muted);
}

.status[data-kind="error"] {
  color: var(--error);
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  line-height: 1.25;
  margin: 1.6em 0 0.6em;
}

.markdown-body h1:first-child,
.markdown-body h2:first-child,
.markdown-body h3:first-child {
  margin-top: 0;
}

.markdown-body a {
  color: var(--accent);
}

.markdown-body pre {
  overflow: auto;
  padding: 16px;
  background: var(--code-bg);
  border-radius: 6px;
}

.markdown-body code {
  font-family: Consolas, "Liberation Mono", monospace;
}

.markdown-body :not(pre) > code {
  padding: 2px 5px;
  background: var(--code-bg);
  border-radius: 4px;
}

.markdown-body blockquote {
  margin-left: 0;
  padding-left: 16px;
  color: var(--muted);
  border-left: 4px solid var(--border);
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
}

.markdown-body th,
.markdown-body td {
  padding: 8px 10px;
  border: 1px solid var(--border);
}

.mermaid {
  margin: 24px 0;
  overflow: auto;
  text-align: center;
}

@media (max-width: 640px) {
  .preview-layout {
    display: block;
    width: 100%;
    margin: 0;
  }

  .document-nav {
    position: static;
    max-height: 42vh;
    border-top: 0;
    border-left: 0;
    border-right: 0;
    border-radius: 0;
  }

  .page-shell {
    width: 100%;
    margin: 0;
    padding: 24px 16px;
    border-left: 0;
    border-right: 0;
    border-radius: 0;
  }
}
`;

module.exports = {
  CLIENT_JS,
  STYLES_CSS,
  pathDirectory,
  pathFromSearch,
  resolvePreviewPath,
  searchForPreviewPath
};
