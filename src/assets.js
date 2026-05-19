const CLIENT_JS = `
(function () {
  const root = document.getElementById('markdown-root');
  const status = document.getElementById('status');

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || 'info';
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
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value || '');
  }

  function rootRelativePath(value) {
    return String(value || '')
      .split('#')[0]
      .split('?')[0]
      .replaceAll('\\\\', '/')
      .replace(/^\\.\\//, '')
      .replace(/^\\/+/, '');
  }

  function contentEndpoint(relativePath) {
    return '/content?path=' + encodeURIComponent(relativePath);
  }

  function rawEndpoint(relativePath) {
    return '/raw?path=' + encodeURIComponent(relativePath);
  }

  function isMarkdownPath(value) {
    return /\\.(md|markdown)$/i.test(rootRelativePath(value));
  }

  function rewriteRelativeUrls() {
    root.querySelectorAll('img[src]').forEach((image) => {
      const source = image.getAttribute('src');
      if (!source || isExternalUrl(source)) {
        return;
      }

      image.setAttribute('src', rawEndpoint(rootRelativePath(source)));
    });

    root.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || isExternalUrl(href)) {
        return;
      }

      const relativePath = rootRelativePath(href);
      link.dataset.previewPath = relativePath;
      link.setAttribute('href', isMarkdownPath(href)
        ? contentEndpoint(relativePath)
        : rawEndpoint(relativePath));
    });
  }

  async function renderMarkdownPath(relativePath) {
    const endpoint = relativePath ? contentEndpoint(rootRelativePath(relativePath)) : '/content';
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const markdown = await response.text();
    root.innerHTML = window.marked.parse(markdown, { breaks: false, gfm: true });
    rewriteRelativeUrls();
    await renderMermaid();
  }

  async function renderMermaid() {
    prepareMermaidBlocks();

    if (!root.querySelector('.mermaid')) {
      return;
    }

    if (!window.mermaid) {
      setStatus('Mermaid library failed to load. Check your network connection.', 'error');
      return;
    }

    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    await window.mermaid.run({ querySelector: '.mermaid' });
  }

  async function render() {
    try {
      if (!window.marked) {
        setStatus('Markdown library failed to load. Check your network connection.', 'error');
        return;
      }

      await renderMarkdownPath('');
      setStatus('');
      status.hidden = true;
    } catch (error) {
      status.hidden = false;
      setStatus(error.message || 'Failed to render markdown.', 'error');
    }
  }

  root.addEventListener('click', async (event) => {
    const link = event.target.closest('a[data-preview-path]');
    if (!link || !isMarkdownPath(link.dataset.previewPath)) {
      return;
    }

    event.preventDefault();

    try {
      status.hidden = false;
      setStatus('Loading markdown...');
      await renderMarkdownPath(link.dataset.previewPath);
      setStatus('');
      status.hidden = true;
    } catch (error) {
      status.hidden = false;
      setStatus(error.message || 'Failed to render markdown.', 'error');
    }
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

.page-shell {
  width: min(960px, calc(100% - 32px));
  margin: 32px auto 64px;
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

module.exports = { CLIENT_JS, STYLES_CSS };
